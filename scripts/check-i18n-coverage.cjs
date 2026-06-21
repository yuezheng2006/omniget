#!/usr/bin/env node

/**
 * i18n 覆盖率检查脚本
 * 用于检测翻译文件的完整性和覆盖率
 */

const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/lib/i18n');
const BASE_LANG = 'en';

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * 递归获取所有翻译键
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push({ key: fullKey, value });
    }
  }
  return keys;
}

/**
 * 检查翻译是否缺失（与英文相同且包含英文字母）
 */
function isMissingTranslation(targetValue, baseValue) {
  if (targetValue === baseValue && /[a-zA-Z]/.test(targetValue)) {
    return true;
  }
  return false;
}

/**
 * 检查单个语言的覆盖率
 */
function checkLanguage(lang, baseData, targetData) {
  const baseKeys = getAllKeys(baseData);
  const targetKeys = getAllKeys(targetData);

  const baseKeyMap = new Map(baseKeys.map(k => [k.key, k.value]));
  const targetKeyMap = new Map(targetKeys.map(k => [k.key, k.value]));

  const missing = [];
  const untranslated = [];

  baseKeys.forEach(({ key, value: baseValue }) => {
    if (!targetKeyMap.has(key)) {
      missing.push({ key, value: baseValue });
    } else {
      const targetValue = targetKeyMap.get(key);
      if (isMissingTranslation(targetValue, baseValue)) {
        untranslated.push({ key, value: baseValue });
      }
    }
  });

  const total = baseKeys.length;
  const translated = total - missing.length - untranslated.length;
  const coverage = (translated / total) * 100;

  return {
    lang,
    total,
    translated,
    missing,
    untranslated,
    coverage,
  };
}

/**
 * 按模块分组未翻译的键
 */
function groupByModule(keys) {
  const groups = {};
  keys.forEach(({ key, value }) => {
    const module = key.split('.')[0];
    if (!groups[module]) {
      groups[module] = [];
    }
    groups[module].push({ key, value });
  });
  return groups;
}

/**
 * 生成覆盖率报告
 */
function generateReport(results) {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'bright');
  log('║         OmniGet i18n 翻译覆盖率检查报告                  ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'bright');

  // 排序：按覆盖率降序
  results.sort((a, b) => b.coverage - a.coverage);

  log('总体概览:', 'cyan');
  log('─'.repeat(60));
  console.log('语言   覆盖率      已翻译/总数     缺失    未翻译   状态');
  log('─'.repeat(60));

  results.forEach(result => {
    const { lang, coverage, translated, total, missing, untranslated } = result;

    let status, statusColor;
    if (coverage >= 90) {
      status = '✅ 优秀';
      statusColor = 'green';
    } else if (coverage >= 70) {
      status = '🟢 良好';
      statusColor = 'green';
    } else if (coverage >= 50) {
      status = '🟡 一般';
      statusColor = 'yellow';
    } else {
      status = '🔴 较差';
      statusColor = 'red';
    }

    const line = `${lang.padEnd(7)}${coverage.toFixed(2)}%    ${translated}/${total}`.padEnd(35) +
                 `${missing.length}`.padEnd(9) + `${untranslated.length}`.padEnd(10);

    log(line + status, statusColor);
  });

  log('─'.repeat(60) + '\n');
}

/**
 * 生成详细的语言报告
 */
function generateDetailedReport(result) {
  const { lang, coverage, total, translated, missing, untranslated } = result;

  log(`\n╔═══════════════════════════════════════════════════════════╗`, 'bright');
  log(`║   ${lang} - 详细报告`, 'bright');
  log(`╚═══════════════════════════════════════════════════════════╝\n`, 'bright');

  log(`📊 统计信息:`, 'cyan');
  log(`   总键数:     ${total}`);
  log(`   已翻译:     ${translated} (${coverage.toFixed(2)}%)`);
  log(`   缺失键:     ${missing.length}`);
  log(`   未翻译键:   ${untranslated.length}\n`);

  if (missing.length > 0) {
    log(`❌ 缺失的键 (${missing.length} 个):`, 'red');
    missing.slice(0, 10).forEach(({ key }) => {
      console.log(`   - ${key}`);
    });
    if (missing.length > 10) {
      log(`   ... 还有 ${missing.length - 10} 个\n`, 'yellow');
    }
  }

  if (untranslated.length > 0) {
    log(`⚠️  未翻译的键 (${untranslated.length} 个):`, 'yellow');

    const grouped = groupByModule(untranslated);
    const sortedModules = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

    log(`\n   按模块分组:`, 'cyan');
    sortedModules.forEach(([module, keys]) => {
      log(`   📦 ${module}: ${keys.length} 个`);
    });

    log(`\n   示例 (前 20 个):`, 'cyan');
    untranslated.slice(0, 20).forEach(({ key, value }) => {
      console.log(`   - ${key}: "${value}"`);
    });

    if (untranslated.length > 20) {
      log(`   ... 还有 ${untranslated.length - 20} 个\n`, 'yellow');
    }
  }

  // 给出建议
  log(`\n💡 改进建议:`, 'cyan');
  if (coverage < 50) {
    log(`   🔴 覆盖率较低，建议优先翻译核心模块：`, 'red');
    log(`      1. command_palette (命令面板)`);
    log(`      2. home (首页)`);
    log(`      3. downloads (下载管理)`);
    log(`      4. settings (设置)`);
  } else if (coverage < 70) {
    log(`   🟡 覆盖率一般，建议继续翻译高优先级模块`, 'yellow');
  } else if (coverage < 90) {
    log(`   🟢 覆盖率良好，可以开始翻译次要模块`, 'green');
  } else {
    log(`   ✅ 覆盖率优秀！可以关注翻译质量和一致性`, 'green');
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const targetLang = args[0];
  const verbose = args.includes('--verbose') || args.includes('-v');

  // 读取基准语言
  const basePath = path.join(I18N_DIR, `${BASE_LANG}.json`);
  if (!fs.existsSync(basePath)) {
    log(`❌ 错误: 找不到基准语言文件 ${basePath}`, 'red');
    process.exit(1);
  }

  const baseData = JSON.parse(fs.readFileSync(basePath, 'utf8'));

  // 获取所有语言文件
  const langFiles = fs.readdirSync(I18N_DIR)
    .filter(f => f.endsWith('.json') && f !== `${BASE_LANG}.json`)
    .map(f => f.replace('.json', ''));

  if (targetLang) {
    // 检查特定语言
    if (!langFiles.includes(targetLang)) {
      log(`❌ 错误: 语言 '${targetLang}' 不存在`, 'red');
      log(`\n可用语言: ${langFiles.join(', ')}`, 'cyan');
      process.exit(1);
    }

    const targetPath = path.join(I18N_DIR, `${targetLang}.json`);
    const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    const result = checkLanguage(targetLang, baseData, targetData);

    generateDetailedReport(result);
  } else {
    // 检查所有语言
    const results = langFiles.map(lang => {
      const targetPath = path.join(I18N_DIR, `${lang}.json`);
      const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      return checkLanguage(lang, baseData, targetData);
    });

    generateReport(results);

    if (verbose) {
      results.forEach(result => {
        if (result.coverage < 100) {
          generateDetailedReport(result);
        }
      });
    }
  }

  log(`\n💡 提示: 使用 'node scripts/check-i18n-coverage.js <语言代码>' 查看详细报告`, 'cyan');
  log(`   例如: node scripts/check-i18n-coverage.js zh\n`, 'cyan');
}

// 运行
try {
  main();
} catch (error) {
  log(`\n❌ 错误: ${error.message}`, 'red');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
