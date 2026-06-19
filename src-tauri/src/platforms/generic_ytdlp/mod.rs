use omniget_core::models::progress::ProgressUpdate;
use std::collections::HashMap;

use anyhow::anyhow;
use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::core::direct_downloader;
use crate::core::hls_downloader::HlsDownloader;
use crate::core::ytdlp;
use crate::models::media::{
    DownloadOptions, DownloadResult, MediaInfo, MediaType, VideoQuality as MediaVideoQuality,
};
use crate::platforms::traits::PlatformDownloader;

pub struct GenericYtdlpDownloader;

impl Default for GenericYtdlpDownloader {
    fn default() -> Self {
        Self::new()
    }
}

impl GenericYtdlpDownloader {
    pub fn new() -> Self {
        Self
    }

    fn extract_quality_height(quality_str: &str) -> Option<u32> {
        let s = quality_str.trim().to_lowercase();
        if s == "best" || s == "highest" {
            return None;
        }
        s.trim_end_matches('p').parse::<u32>().ok()
    }

    fn detect_platform(json: &serde_json::Value) -> String {
        json.get("extractor_key")
            .or_else(|| json.get("extractor"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| "generic".to_string())
    }

    fn detect_media_type(json: &serde_json::Value) -> MediaType {
        let has_video = json
            .get("formats")
            .and_then(|v| v.as_array())
            .map(|formats| {
                formats.iter().any(|f| {
                    f.get("vcodec")
                        .and_then(|v| v.as_str())
                        .map(|v| v != "none")
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false);

        if has_video {
            MediaType::Video
        } else {
            MediaType::Audio
        }
    }

    pub fn parse_video_info(json: &serde_json::Value) -> anyhow::Result<MediaInfo> {
        let title = json
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let author = json
            .get("uploader")
            .or_else(|| json.get("channel"))
            .or_else(|| json.get("uploader_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let duration = json.get("duration").and_then(|v| v.as_f64());

        let thumbnail = json
            .get("thumbnail")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let webpage_url = json
            .get("webpage_url")
            .or_else(|| json.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let platform = Self::detect_platform(json);
        let media_type = Self::detect_media_type(json);

        let mut qualities: Vec<MediaVideoQuality> = Vec::new();
        let mut best_by_height: HashMap<u32, (u32, u32, f64)> = HashMap::new();

        if media_type == MediaType::Video {
            if let Some(formats) = json.get("formats").and_then(|v| v.as_array()) {
                for f in formats {
                    let height = f.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let width = f.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    let vcodec = f.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
                    let tbr = f.get("tbr").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let filesize = f.get("filesize").and_then(|v| v.as_u64()).unwrap_or(0);

                    if vcodec == "none" || height == 0 {
                        continue;
                    }

                    let score = if tbr > 0.0 {
                        tbr
                    } else if filesize > 0 {
                        filesize as f64
                    } else {
                        1.0
                    };

                    let entry = best_by_height.entry(height).or_insert((width, height, 0.0));
                    if score > entry.2 {
                        *entry = (width, height, score);
                    }
                }
            }

            let mut sorted_heights: Vec<u32> = best_by_height.keys().copied().collect();
            sorted_heights.sort_by(|a, b| b.cmp(a));

            for height in sorted_heights {
                if let Some(&(width, _, _)) = best_by_height.get(&height) {
                    qualities.push(MediaVideoQuality {
                        label: format!("{}p", height),
                        width,
                        height,
                        url: webpage_url.clone(),
                        format: "ytdlp".to_string(),
                    });
                }
            }
        }

        if qualities.is_empty() {
            qualities.push(MediaVideoQuality {
                label: "best".to_string(),
                width: 0,
                height: 0,
                url: webpage_url,
                format: "ytdlp".to_string(),
            });
        }

        Ok(MediaInfo {
            title,
            author,
            platform,
            duration_seconds: duration,
            thumbnail_url: thumbnail,
            available_qualities: qualities,
            media_type,
            file_size_bytes: None,
        })
    }
}

fn is_direct_media_url(url: &str) -> Option<&'static str> {
    let path = url::Url::parse(url).ok().map(|u| u.path().to_lowercase())?;

    if path.contains(".m3u8") {
        return Some("hls");
    }

    for ext in &[".mp4", ".webm", ".m4v", ".mkv", ".avi", ".mov", ".flv"] {
        if path.contains(ext) {
            return Some("direct");
        }
    }

    for ext in &[".mp3", ".m4a", ".ogg", ".wav", ".flac", ".aac"] {
        if path.contains(ext) {
            return Some("direct");
        }
    }

    None
}

fn filename_from_url(url: &str) -> String {
    url::Url::parse(url)
        .ok()
        .and_then(|u| {
            let path = u.path();
            let last = path.rsplit('/').next()?;
            if last.is_empty() || !last.contains('.') {
                return None;
            }
            Some(
                urlencoding::decode(last)
                    .unwrap_or_else(|_| last.into())
                    .to_string(),
            )
        })
        .map(|name| sanitize_filename::sanitize(&name))
        .unwrap_or_else(|| "download".to_string())
}

fn build_direct_media_info(url: &str, media_type_hint: &str) -> MediaInfo {
    let title = filename_from_url(url);
    let (format, media_type) = match media_type_hint {
        "hls" => ("hls".to_string(), MediaType::Video),
        _ => {
            let lower = url.to_lowercase();
            if lower.contains(".mp3")
                || lower.contains(".m4a")
                || lower.contains(".ogg")
                || lower.contains(".wav")
                || lower.contains(".flac")
                || lower.contains(".aac")
            {
                ("direct_audio".to_string(), MediaType::Audio)
            } else {
                ("direct_video".to_string(), MediaType::Video)
            }
        }
    };

    MediaInfo {
        title,
        author: String::new(),
        platform: "generic".to_string(),
        duration_seconds: None,
        thumbnail_url: None,
        available_qualities: vec![MediaVideoQuality {
            label: "original".to_string(),
            width: 0,
            height: 0,
            url: url.to_string(),
            format,
        }],
        media_type,
        file_size_bytes: None,
    }
}

#[async_trait]
impl PlatformDownloader for GenericYtdlpDownloader {
    fn name(&self) -> &str {
        "generic"
    }

    fn can_handle(&self, url: &str) -> bool {
        if let Ok(parsed) = url::Url::parse(url) {
            let scheme = parsed.scheme();
            return scheme == "http" || scheme == "https";
        }
        false
    }

    async fn get_media_info(&self, url: &str) -> anyhow::Result<MediaInfo> {
        if let Some(media_type) = is_direct_media_url(url) {
            return Ok(build_direct_media_info(url, media_type));
        }

        let ytdlp_path = ytdlp::ensure_ytdlp()
            .await
            .map_err(|e| anyhow!("yt-dlp unavailable: {}", e))?;

        let extra = platform_extra_flags(url);
        let json = ytdlp::get_video_info(&ytdlp_path, url, &extra).await?;
        Self::parse_video_info(&json)
    }

    async fn download(
        &self,
        info: &MediaInfo,
        opts: &DownloadOptions,
        progress: mpsc::Sender<ProgressUpdate>,
    ) -> anyhow::Result<DownloadResult> {
        let _ = progress.send(ProgressUpdate::percent(0.0)).await;

        let first = info
            .available_qualities
            .first()
            .ok_or_else(|| anyhow!("No quality available"))?;

        let requested_height = opts
            .quality
            .as_deref()
            .and_then(Self::extract_quality_height);

        let selected = if let Some(h) = requested_height {
            info.available_qualities
                .iter()
                .filter(|q| q.height > 0 && q.height <= h)
                .max_by_key(|q| q.height)
                .or_else(|| {
                    opts.quality
                        .as_deref()
                        .and_then(|w| info.available_qualities.iter().find(|q| q.label == *w))
                })
                .unwrap_or(first)
        } else if let Some(ref wanted) = opts.quality {
            info.available_qualities
                .iter()
                .find(|q| q.label == *wanted)
                .unwrap_or(first)
        } else {
            first
        };

        if selected.format == "hls" {
            let title = sanitize_filename::sanitize(&info.title);
            let filename = if title.ends_with(".mp4") {
                title
            } else {
                format!("{}.mp4", title)
            };
            let output_path = opts.output_dir.join(&filename);
            let output_str = output_path.to_string_lossy().to_string();

            let referer = opts
                .referer
                .as_deref()
                .or_else(|| platform_referer(&selected.url))
                .unwrap_or("");

            let mut builder =
                crate::core::http_client::apply_global_proxy(reqwest::Client::builder())
                    .timeout(std::time::Duration::from_secs(600));

            if let Some(ua) = opts.user_agent.as_deref() {
                builder = builder.user_agent(ua);
            }

            if let Some(ref hdrs) = opts.extra_headers {
                let mut default_headers = reqwest::header::HeaderMap::new();
                for (name, value) in hdrs {
                    if let (Ok(hname), Ok(hval)) = (
                        reqwest::header::HeaderName::from_bytes(name.as_bytes()),
                        reqwest::header::HeaderValue::from_str(value),
                    ) {
                        default_headers.insert(hname, hval);
                    }
                }
                if !default_headers.is_empty() {
                    builder = builder.default_headers(default_headers);
                }
            }

            let jar = crate::core::cookie_parser::load_extension_cookies_for_url(&selected.url)
                .or_else(|| {
                    opts.referer
                        .as_deref()
                        .and_then(crate::core::cookie_parser::load_extension_cookies_for_url)
                });
            if let Some(jar) = jar {
                builder = builder.cookie_provider(jar);
            }

            let client = builder.build().unwrap_or_default();
            let downloader = HlsDownloader::with_client(client)
                .with_user_agent_override(opts.user_agent.clone());
            let _ = progress.send(ProgressUpdate::percent(0.0)).await;

            let result = downloader
                .download(
                    &selected.url,
                    &output_str,
                    referer,
                    None,
                    opts.cancel_token.clone(),
                    20,
                    3,
                )
                .await?;

            let _ = progress.send(ProgressUpdate::percent(100.0)).await;

            return Ok(DownloadResult {
                file_path: result.path,
                file_size_bytes: result.file_size,
                duration_seconds: 0.0,
                torrent_id: None,
            });
        }

        if selected.format == "direct_video" || selected.format == "direct_audio" {
            let title = sanitize_filename::sanitize(&info.title);
            let output_path = opts.output_dir.join(&title);

            let mut builder =
                crate::core::http_client::apply_global_proxy(reqwest::Client::builder())
                    .timeout(std::time::Duration::from_secs(600));

            if let Some(ua) = opts.user_agent.as_deref() {
                builder = builder.user_agent(ua);
            }

            let jar = crate::core::cookie_parser::load_extension_cookies_for_url(&selected.url)
                .or_else(|| {
                    opts.referer
                        .as_deref()
                        .and_then(crate::core::cookie_parser::load_extension_cookies_for_url)
                });
            if let Some(jar) = jar {
                builder = builder.cookie_provider(jar);
            }

            let client = builder.build().unwrap_or_default();

            let mut headers = reqwest::header::HeaderMap::new();
            if let Some(ref r) = opts.referer {
                if let Ok(val) = reqwest::header::HeaderValue::from_str(r) {
                    headers.insert(reqwest::header::REFERER, val);
                }
            }
            if let Some(ref hdrs) = opts.extra_headers {
                for (name, value) in hdrs {
                    if let (Ok(hname), Ok(hval)) = (
                        reqwest::header::HeaderName::from_bytes(name.as_bytes()),
                        reqwest::header::HeaderValue::from_str(value),
                    ) {
                        headers.insert(hname, hval);
                    }
                }
            }
            crate::core::http_client::inject_ua_header(&mut headers, opts.user_agent.as_deref());

            let bytes = direct_downloader::download_direct_with_headers(
                &client,
                &selected.url,
                &output_path,
                progress,
                Some(headers),
                Some(&opts.cancel_token),
            )
            .await?;

            return Ok(DownloadResult {
                file_path: output_path,
                file_size_bytes: bytes,
                duration_seconds: 0.0,
                torrent_id: None,
            });
        }

        let ytdlp_path = if let Some(ref p) = opts.ytdlp_path {
            p.clone()
        } else {
            ytdlp::ensure_ytdlp().await?
        };

        let quality_height =
            requested_height.or_else(|| Self::extract_quality_height(&selected.label));
        let video_url = &selected.url;

        let referer = opts
            .referer
            .as_deref()
            .or_else(|| platform_referer(video_url));

        let format_fallbacks: &[Option<&str>] = if opts.format_id.is_some() {
            &[None]
        } else {
            &[None, Some("b"), Some("worst")]
        };

        let mut last_err: Option<anyhow::Error> = None;
        let extra_flags_owned: Vec<String> = opts
            .custom_ytdlp_args
            .as_deref()
            .map(|v| v.to_vec())
            .unwrap_or_default();
        for (idx, override_format) in format_fallbacks.iter().enumerate() {
            let effective_format = override_format.or(opts.format_id.as_deref());
            let attempt_progress = progress.clone();
            let result = ytdlp::download_video(
                &ytdlp_path,
                video_url,
                &opts.output_dir,
                quality_height,
                attempt_progress,
                opts.download_mode.as_deref(),
                effective_format,
                opts.filename_template.as_deref(),
                referer,
                opts.cancel_token.clone(),
                None,
                opts.concurrent_fragments,
                opts.download_subtitles,
                &extra_flags_owned,
                opts.audio_format.as_deref(),
            )
            .await;

            match result {
                Ok(r) => return Ok(r),
                Err(e) => {
                    let msg = e.to_string().to_lowercase();
                    let is_format_error = msg.contains("requested format")
                        || msg.contains("format is not available")
                        || msg.contains("no video formats")
                        || msg.contains("no suitable format");
                    let has_more = idx + 1 < format_fallbacks.len();
                    if is_format_error && has_more && !opts.cancel_token.is_cancelled() {
                        tracing::warn!(
                            "[generic_ytdlp] format fallback {}/{} after error: {}",
                            idx + 1,
                            format_fallbacks.len() - 1,
                            e
                        );
                        last_err = Some(e);
                        continue;
                    }
                    return Err(e);
                }
            }
        }

        Err(last_err.unwrap_or_else(|| anyhow!("download failed without specific error")))
    }
}

fn platform_extra_flags(url: &str) -> Vec<String> {
    match platform_referer(url) {
        Some(r) => vec!["--referer".into(), r.to_string()],
        None => Vec::new(),
    }
}

fn platform_referer(url: &str) -> Option<&'static str> {
    let lower = url.to_lowercase();

    if lower.contains("douyin.com") || lower.contains("iesdouyin.com") {
        return Some("https://www.douyin.com/");
    }
    if lower.contains("v.qq.com") || lower.contains("qq.com/x/") {
        return Some("https://v.qq.com/");
    }
    if lower.contains("youku.com") {
        return Some("https://www.youku.com/");
    }
    if lower.contains("iqiyi.com") {
        return Some("https://www.iqiyi.com/");
    }
    if lower.contains("mgtv.com") {
        return Some("https://www.mgtv.com/");
    }
    if lower.contains("kuaishou.com") {
        return Some("https://www.kuaishou.com/");
    }
    if lower.contains("xiaohongshu.com") || lower.contains("xhslink.com") {
        return Some("https://www.xiaohongshu.com/");
    }
    if lower.contains("bilibili.com") || lower.contains("bilibili.tv") {
        return Some("https://www.bilibili.com/");
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn create_test_format(height: u32, width: u32, tbr: f64, vcodec: &str) -> serde_json::Value {
        json!({
            "height": height,
            "width": width,
            "tbr": tbr,
            "vcodec": vcodec,
            "acodec": "mp4a.40.2"
        })
    }

    #[test]
    fn test_parse_video_info_picks_best_by_tbr() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "duration": 123.45,
            "thumbnail": "https://example.com/thumb.jpg",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                create_test_format(1080, 1920, 5000.0, "avc1.640028"),
                create_test_format(1080, 1920, 8000.0, "avc1.640028"),
                create_test_format(1080, 1920, 6000.0, "vp09.00.50.08"),
                create_test_format(720, 1280, 3000.0, "avc1.4d401f"),
                create_test_format(720, 1280, 4000.0, "vp09.00.40.08"),
                create_test_format(720, 1280, 3500.0, "avc1.4d401e"),
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.title, "Test Video");
        assert_eq!(result.author, "Test Author");

        // Should have exactly 2 qualities, not 6
        assert_eq!(result.available_qualities.len(), 2);

        // Check that they are sorted descending
        assert_eq!(result.available_qualities[0].height, 1080);
        assert_eq!(result.available_qualities[1].height, 720);
    }

    #[test]
    fn test_parse_video_info_fallback_to_filesize_when_no_tbr() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 1080,
                    "width": 1920,
                    "filesize": 100_000_000,
                    "vcodec": "avc1.640028",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 1080,
                    "width": 1920,
                    "filesize": 150_000_000,
                    "vcodec": "vp09.00.50.08",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 1080,
                    "width": 1920,
                    "filesize": 120_000_000,
                    "vcodec": "avc1.64002a",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].height, 1080);
    }

    #[test]
    fn test_parse_video_info_fallback_to_first_when_no_tbr_or_filesize() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 1080,
                    "width": 1920,
                    "vcodec": "avc1.640028",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 1080,
                    "width": 1920,
                    "vcodec": "vp09.00.50.08",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].height, 1080);
    }

    #[test]
    fn test_parse_video_info_skips_formats_without_video() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 1080,
                    "width": 1920,
                    "tbr": 8000.0,
                    "vcodec": "none",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 720,
                    "width": 1280,
                    "tbr": 4000.0,
                    "vcodec": "avc1.4d401f",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].height, 720);
    }

    #[test]
    fn test_parse_video_info_skips_formats_with_zero_height() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 0,
                    "width": 0,
                    "tbr": 8000.0,
                    "vcodec": "avc1.640028",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 720,
                    "width": 1280,
                    "tbr": 4000.0,
                    "vcodec": "avc1.4d401f",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].height, 720);
    }

    #[test]
    fn test_parse_video_info_adds_best_when_no_valid_formats() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 0,
                    "width": 0,
                    "tbr": 8000.0,
                    "vcodec": "none",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].label, "best");
    }

    #[test]
    fn test_parse_video_info_audio_only() {
        let json = json!({
            "title": "Test Audio",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/audio",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 0,
                    "width": 0,
                    "tbr": 128.0,
                    "vcodec": "none",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 0,
                    "width": 0,
                    "tbr": 256.0,
                    "vcodec": "none",
                    "acodec": "mp4a.40.5"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.media_type, MediaType::Audio);
        assert_eq!(result.available_qualities.len(), 1);
        assert_eq!(result.available_qualities[0].label, "best");
    }

    #[test]
    fn test_parse_video_info_mixed_tbr_and_filesize() {
        let json = json!({
            "title": "Test Video",
            "uploader": "Test Author",
            "webpage_url": "https://example.com/video",
            "extractor_key": "generic",
            "formats": [
                {
                    "height": 1080,
                    "width": 1920,
                    "filesize": 200_000_000,
                    "vcodec": "avc1.640028",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 1080,
                    "width": 1920,
                    "tbr": 8000.0,
                    "vcodec": "vp09.00.50.08",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 720,
                    "width": 1280,
                    "tbr": 4000.0,
                    "vcodec": "avc1.4d401f",
                    "acodec": "mp4a.40.2"
                },
                {
                    "height": 720,
                    "width": 1280,
                    "filesize": 100_000_000,
                    "vcodec": "vp09.00.40.08",
                    "acodec": "mp4a.40.2"
                }
            ]
        });

        let result = GenericYtdlpDownloader::parse_video_info(&json).unwrap();

        assert_eq!(result.available_qualities.len(), 2);
        assert_eq!(result.available_qualities[0].height, 1080);
        assert_eq!(result.available_qualities[1].height, 720);
    }
}
