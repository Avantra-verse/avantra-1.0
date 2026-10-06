const fs = require('fs');

const files = ['public/index.html', 'public/multiverse/index.html'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/about"\s*target="_blank"\s*rel="noopener"/g, 'href="/about"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/contact"\s*target="_blank"\s*rel="noopener"/g, 'href="/contact"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/venue"\s*target="_blank"\s*rel="noopener"/g, 'href="/venue"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/sponsors"\s*target="_blank"\s*rel="noopener"/g, 'href="/sponsors"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/about"/g, 'href="/about"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/contact"/g, 'href="/contact"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/venue"/g, 'href="/venue"');
    content = content.replace(/href="https:\/\/avantra\.arithi\.in\/sponsors"/g, 'href="/sponsors"');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
