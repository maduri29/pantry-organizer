import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const name of ['index.html','styles.css'])await copyFile(name,`public/${name}`);
await cp('src','public/src',{recursive:true});
const env={
  apiKey:process.env.PANTRY_FIREBASE_API_KEY,
  authDomain:process.env.PANTRY_FIREBASE_AUTH_DOMAIN,
  projectId:process.env.PANTRY_FIREBASE_PROJECT_ID,
  appId:process.env.PANTRY_FIREBASE_APP_ID
};
if(Object.values(env).every(Boolean)){
  const config={firebase:env,householdId:process.env.PANTRY_HOUSEHOLD_ID||'our-pantry'};
  await writeFile('public/config.js',`window.PANTRY_CONFIG = ${JSON.stringify(config).replaceAll('<','\\u003c')};\n`);
}else{
  try{await copyFile('config.js','public/config.js');}
  catch{await writeFile('public/config.js','window.PANTRY_CONFIG = {};\n');}
}
console.log('Static hosting files ready in public/');
