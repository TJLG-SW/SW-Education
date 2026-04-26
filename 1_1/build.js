const fs = require('fs');
const path = require('path');

const SRC_DIR = __dirname;
const DIST_DIR = path.join(__dirname, 'dist');

const CSS_FILES = ['styles.css'];
const JS_FILES = ['nodes.js', 'api.js', 'app.js'];
const STATIC_FILES = ['index.html'];

function minifyCSS(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();
}

function minifyJS(content) {
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
}

function getFileInfo(filePath) {
    const stat = fs.statSync(filePath);
    const buf = fs.readFileSync(filePath);
    return { size: stat.size, compressedSize: buf.length };
}

if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('📦 开始构建...\n');

let totalOriginal = 0;
let totalCompressed = 0;

CSS_FILES.forEach(file => {
    const srcPath = path.join(SRC_DIR, file);
    if (!fs.existsSync(srcPath)) return;
    
    const content = fs.readFileSync(srcPath, 'utf-8');
    const minified = minifyCSS(content);
    const outPath = path.join(DIST_DIR, file.replace('.css', '.min.css'));
    
    fs.writeFileSync(outPath, minified, 'utf-8');
    
    const origSize = Buffer.byteLength(content, 'utf-8');
    const compSize = Buffer.byteLength(minified, 'utf-8');
    totalOriginal += origSize;
    totalCompressed += compSize;
    
    console.log(`  ✅ ${file} → ${path.basename(outPath)} (${(origSize/1024).toFixed(1)}KB → ${(compSize/1024).toFixed(1)}KB, ${((1-compSize/origSize)*100).toFixed(0)}% 减少)`);
});

JS_FILES.forEach(file => {
    const srcPath = path.join(SRC_DIR, file);
    if (!fs.existsSync(srcPath)) return;
    
    const content = fs.readFileSync(srcPath, 'utf-8');
    const minified = minifyJS(content);
    const outPath = path.join(DIST_DIR, file.replace('.js', '.min.js'));
    
    fs.writeFileSync(outPath, minified, 'utf-8');
    
    const origSize = Buffer.byteLength(content, 'utf-8');
    const compSize = Buffer.byteLength(minified, 'utf-8');
    totalOriginal += origSize;
    totalCompressed += compSize;
    
    console.log(`  ✅ ${file} → ${path.basename(outPath)} (${(origSize/1024).toFixed(1)}KB → ${(compSize/1024).toFixed(1)}KB, ${((1-compSize/origSize)*100).toFixed(0)}% 减少)`);
});

STATIC_FILES.forEach(file => {
    const srcPath = path.join(SRC_DIR, file);
    if (!fs.existsSync(srcPath)) return;
    
    let content = fs.readFileSync(srcPath, 'utf-8');
    
    content = content
        .replace(/src="nodes\.js(\?[^"]*)?"/g, 'src="nodes.min.js$1"')
        .replace(/src="api\.js(\?[^"]*)?"/g, 'src="api.min.js$1"')
        .replace(/src="app\.js(\?[^"]*)?"/g, 'src="app.min.js$1"')
        .replace(/href="styles\.css(\?[^"]*)?"/g, 'href="styles.min.css$1"');
    
    fs.writeFileSync(path.join(DIST_DIR, file), content, 'utf-8');
    console.log(`  ✅ ${file} → dist/${file} (引用已更新为压缩版本)`);
});

console.log(`\n📊 构建完成！`);
console.log(`   原始大小: ${(totalOriginal/1024).toFixed(1)}KB`);
console.log(`   压缩后:  ${(totalCompressed/1024).toFixed(1)}KB`);
console.log(`   总减少:  ${((1-totalCompressed/totalOriginal)*100).toFixed(0)}%`);
console.log(`\n📁 输出目录: ${DIST_DIR}`);
console.log('\n使用方法: cd dist && python -m http.server 8080');
