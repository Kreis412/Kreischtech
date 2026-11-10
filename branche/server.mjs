import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {openStore,createHandler} from './app.mjs';
const base=fileURLToPath(new URL('.',import.meta.url));
export async function start({directory=join(base,'data'),port=4179}={}){const store=await openStore({directory}),handler=createHandler(store);const server=createServer((req,res)=>{if(req.url.startsWith('/api/'))return handler(req,res);const path=new URL(req.url,'http://localhost').pathname;const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/safety.html':'safety.html'}[path];if(!file){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(readFileSync(join(base,'public',file)));});await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,close:async()=>{await new Promise(r=>server.close(r));await store.close();}};}
if(process.argv[1]===fileURLToPath(import.meta.url)){await start();console.log('Branche local test: http://127.0.0.1:4179');}
