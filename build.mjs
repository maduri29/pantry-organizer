import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const name of ['index.html','styles.css','config.js'])await copyFile(name,`public/${name}`);
await cp('src','public/src',{recursive:true});
console.log('Static hosting files ready in public/');
