export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  ETHERSCAN_API_KEY?: string;
  BSC_RPC_URL?: string;
  TRONGRID_API_KEY?: string;
  TONAPI_API_KEY?: string;
  BOT_USERNAME: string;
  ADMIN_IDS: string;
  PUBLIC_BASE_URL: string;
  WEBHOOK_SECRET?: string;
  USDT_BEP20_WALLET: string;
  USDT_BEP20_TOKEN: string;
  USDT_TRC20_WALLET?: string;
  USDT_TRC20_TOKEN?: string;
  TON_WALLET?: string;
  TON_USD_RATE?: string;
  ETHERSCAN_CHAIN_ID: string;
  CARD_NUMBER: string;
  CARD_HOLDER: string;
  CREDIT_USD_PRICE: string;
  REFERRAL_REWARD: string;
  INVOICE_EXPIRE_MINUTES: string;
  ADMIN_WEB_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  SETUP_SECRET?: string;
  STOCK_ENCRYPTION_KEY?: string;
}

type TgUser = { id:number; username?:string; first_name?:string };
type Chat = { id:number };
type Photo = { file_id:string };
type Document = { file_id:string; file_name?:string };
type Message = { message_id:number; chat:Chat; from?:TgUser; text?:string; caption?:string; photo?:Photo[]; document?:Document };
type CallbackQuery = { id:string; from:TgUser; message?:Message; data?:string };
type Update = { message?:Message; callback_query?:CallbackQuery };
type CopyTextButton = { text:string };
type Btn = { text:string; callback_data?:string; url?:string; copy_text?:CopyTextButton };

const j=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const esc=(s:string='')=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c] as string));
const nowIso=()=>new Date().toISOString();
function randomHex(bytes=12){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');}
const publicId=(p:string)=>`${p}${randomHex(10).toUpperCase()}`;
function secureRandomInt(maxExclusive:number){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%maxExclusive;}
const BSC_MAINNET_CHAIN_ID='56';
const BSC_USDT_CONTRACT='0x55d398326f99059fF775485246999027B3197955';
const TRON_USDT_CONTRACT='TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const DEFAULT_BSC_RPC='https://bsc-dataseed.binance.org/';
const ERC20_TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const normEvm=(v:string='')=>v.trim().toLowerCase();
const admins=(env:Env)=>new Set((env.ADMIN_IDS||'').split(',').map(x=>Number(x.trim())).filter(Boolean));
const isAdmin=(env:Env,id:number)=>admins(env).has(id);

async function tg(env:Env,method:string,body:any){
  const r=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data:any=await r.json();
  if(!data.ok) console.log('TG error',method,data);
  return data;
}
async function send(env:Env,chat_id:number,text:string,rows:Btn[][]=[]){
  return tg(env,'sendMessage',{chat_id,text,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:{inline_keyboard:rows}});
}
async function edit(env:Env,chat_id:number,message_id:number,text:string,rows:Btn[][]=[]){
  return tg(env,'editMessageText',{chat_id,message_id,text,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:{inline_keyboard:rows}});
}
async function answerCb(env:Env,id:string,text?:string,show_alert=false){
  if(!id) return;
  return tg(env,'answerCallbackQuery',{callback_query_id:id,text,show_alert});
}
async function logAdmin(env:Env,adminId:number,action:string,refType?:string,refId?:string,details?:string){
  await env.DB.prepare('INSERT INTO admin_logs(admin_telegram_id,action,ref_type,ref_id,details) VALUES(?,?,?,?,?)').bind(adminId,action,refType||null,refId||null,details||null).run();
}

function bytesToB64(bytes:Uint8Array){let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin);}
function b64ToBytes(v:string){const bin=atob(v);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
async function stockKey(env:Env){
  if(!env.STOCK_ENCRYPTION_KEY||env.STOCK_ENCRYPTION_KEY.length<24)return null;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.STOCK_ENCRYPTION_KEY));
  return crypto.subtle.importKey('raw',digest,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encryptStock(env:Env,value:string){
  if(value.startsWith('enc:v1:'))return value;
  const key=await stockKey(env);if(!key)throw new Error('STOCK_ENCRYPTION_KEY is missing or too short');
  const iv=new Uint8Array(12);crypto.getRandomValues(iv);
  const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));
  return `enc:v1:${bytesToB64(iv)}:${bytesToB64(data)}`;
}
async function decryptStock(env:Env,value:string){
  if(!value.startsWith('enc:v1:'))return value;
  const key=await stockKey(env);if(!key)throw new Error('STOCK_ENCRYPTION_KEY is required to decrypt stock');
  const parts=value.split(':');if(parts.length!==4)throw new Error('invalid encrypted stock');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(parts[2])},key,b64ToBytes(parts[3]));
  return new TextDecoder().decode(plain);
}
async function migratePlainStock(env:Env,limit=50){
  if(!(await stockKey(env)))return 0;
  const q:any=await env.DB.prepare("SELECT id,secret_value FROM product_stock WHERE status='available' AND secret_value NOT LIKE 'enc:v1:%' ORDER BY id LIMIT ?").bind(limit).all();
  const rows=q.results||[];if(!rows.length)return 0;
  const stmts=[] as D1PreparedStatement[];
  for(const row of rows)stmts.push(env.DB.prepare('UPDATE product_stock SET secret_value=? WHERE id=? AND secret_value=?').bind(await encryptStock(env,String(row.secret_value)),row.id,row.secret_value));
  await env.DB.batch(stmts);return rows.length;
}

async function upsertUser(env:Env,u:TgUser,startParam?:string){
  const old:any=await env.DB.prepare('SELECT * FROM users WHERE telegram_id=?').bind(u.id).first();
  if(!old){
    let inviter:number|null=null;
    if(startParam?.startsWith('ref_')){
      const n=Number(startParam.slice(4)); if(Number.isFinite(n)&&n!==u.id) inviter=n;
    }
    await env.DB.prepare('INSERT INTO users(telegram_id,username,first_name,inviter_telegram_id) VALUES(?,?,?,?)').bind(u.id,u.username||null,u.first_name||null,inviter).run();
    if(inviter){
      await env.DB.prepare("INSERT OR IGNORE INTO referrals(inviter_telegram_id,invitee_telegram_id,status,reward) VALUES(?,?,'pending',?)").bind(inviter,u.id,Number(env.REFERRAL_REWARD||0.05)).run();
    }
  } else {
    await env.DB.prepare('UPDATE users SET username=?,first_name=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?').bind(u.username||null,u.first_name||null,u.id).run();
  }
}

async function requiredChannels(env:Env){
  const q:any=await env.DB.prepare('SELECT * FROM required_channels WHERE enabled=1 ORDER BY sort_order,id').all(); return q.results||[];
}
async function checkJoin(env:Env,uid:number){
  const missing:any[]=[];
  for(const c of await requiredChannels(env)){
    try{
      const r=await tg(env,'getChatMember',{chat_id:c.chat_id,user_id:uid});
      const st=r.result?.status;
      if(!r.ok||!['creator','administrator','member','restricted'].includes(st)) missing.push(c);
    }catch{missing.push(c)}
  }
  return missing;
}
async function joinGate(env:Env,uid:number,chat:number,messageId?:number){
  const missing=await checkJoin(env,uid);
  if(!missing.length){
    await env.DB.prepare('UPDATE users SET join_verified=1 WHERE telegram_id=?').bind(uid).run();
    await qualifyReferral(env,uid);
    return false;
  }
  const rows:Btn[][]=missing.map((c:any)=>[{text:`📢 عضویت در ${c.title}`,url:c.join_url}]);
  rows.push([{text:'✅ عضو شدم؛ بررسی عضویت',callback_data:'join:check'}]);
  const t='🔒 <b>عضویت الزامی</b>\n\nبرای استفاده از ربات ابتدا در کانال‌های زیر عضو شو و سپس روی «بررسی عضویت» بزن.';
  if(messageId) await edit(env,chat,messageId,t,rows); else await send(env,chat,t,rows);
  return true;
}
async function qualifyReferral(env:Env,invitee:number){await rewardReferral(env,invitee,'join');}

async function balance(env:Env,uid:number){
  const r:any=await env.DB.prepare("SELECT COALESCE(SUM(amount),0) total,COALESCE(SUM(CASE WHEN kind='referral' THEN amount ELSE 0 END),0) referral FROM credit_ledger WHERE telegram_id=?").bind(uid).first();
  return {total:Number(r?.total||0),referral:Number(r?.referral||0),topup:Number(r?.total||0)-Number(r?.referral||0)};
}

async function menu(env:Env,uid:number):Promise<Btn[][]>{
  const rows:Btn[][]=[];
  if(await featureEnabled(env,'feature_shop',true))rows.push([{text:'🛍 فروشگاه',callback_data:'shop:list'},{text:'💰 کیف پول',callback_data:'balance'}]);
  else rows.push([{text:'💰 کیف پول',callback_data:'balance'}]);
  rows.push([{text:'💳 افزایش اعتبار',callback_data:'credit:buy'},{text:'📜 سفارش‌ها و تاریخچه',callback_data:'history:menu'}]);
  const community:Btn[]=[];if(await featureEnabled(env,'feature_referral',true))community.push({text:'🎁 دعوت و درآمد',callback_data:'referral'});if(await featureEnabled(env,'feature_support',true))community.push({text:'🆘 پشتیبانی',callback_data:'support:menu'});if(community.length)rows.push(community);
  rows.push([{text:'🟢 وضعیت سرویس',callback_data:'status'}]);
  if(isAdmin(env,uid))rows.push([{text:'🛠 ورود به حالت مدیریت',callback_data:'admin:home'}]);
  return rows;
}
async function showMenu(env:Env,chat:number,messageId?:number){
  const t='👋 <b>به ربات خوش اومدی!</b>\n\nاز اینجا می‌تونی اعتبار بخری، محصولات دیجیتال تهیه کنی، سفارش‌هات رو ببینی و از دعوت دوستان درآمد بگیری.';
  const rows=await menu(env,chat);if(messageId)await edit(env,chat,messageId,t,rows); else await send(env,chat,t,rows);
}
async function showBalance(env:Env,uid:number,chat:number,mid?:number){
  const b=await balance(env,uid);
  const t=`💰 <b>موجودی حساب</b>\n\n💳 اعتبار خریداری‌شده: <b>${b.topup.toFixed(2)}</b>\n🎁 اعتبار دعوت: <b>${b.referral.toFixed(2)}</b>\n━━━━━━━━━━\n💎 مجموع: <b>${b.total.toFixed(2)} Credit</b>`;
  const rows=[[{text:'💳 خرید اعتبار',callback_data:'credit:buy'},{text:'🏠 منوی اصلی',callback_data:'menu'}]];
  mid?await edit(env,chat,mid,t,rows):await send(env,chat,t,rows);
}

async function showCreditPackages(env:Env,chat:number,mid?:number){
  const q:any=await env.DB.prepare('SELECT * FROM credit_packages WHERE enabled=1 ORDER BY sort_order,id').all();
  const rows:Btn[][]=(q.results||[]).map((p:any)=>[{text:p.title,callback_data:`credit:pkg:${p.id}`}]);
  rows.push([{text:'✏️ مقدار دلخواه',callback_data:'credit:custom'}],[{text:'⬅️ بازگشت',callback_data:'menu'}]);
  const t='💳 <b>خرید اعتبار</b>\n\nهر 1 Credit برای خرید محصولات داخل ربات قابل استفاده است.\n\nیکی از بسته‌ها را انتخاب کن:';
  mid?await edit(env,chat,mid,t,rows):await send(env,chat,t,rows);
}
async function getSetting(env:Env,key:string,fallback=''){
  const r:any=await env.DB.prepare('SELECT value FROM bot_settings WHERE key=?').bind(key).first();
  if(r&&r.value!==null&&r.value!==undefined)return String(r.value);
  return String(fallback||'');
}
async function setSetting(env:Env,key:string,value:string){
  await env.DB.prepare('INSERT INTO bot_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run();
}

async function featureEnabled(env:Env,key:string,def=true){const v=(await getSetting(env,key,def?'1':'0')).toLowerCase();return !['0','false','off','no'].includes(v);}
async function maintenanceOn(env:Env){return featureEnabled(env,'maintenance_mode',false);}
async function getUserAccess(env:Env,uid:number){const u:any=await env.DB.prepare('SELECT banned,risk_level,risk_note,purchase_limit,referral_disabled FROM users WHERE telegram_id=?').bind(uid).first();return u||{banned:0,risk_level:'normal',referral_disabled:0};}
async function isBlacklisted(env:Env,kind:'wallet'|'txid'|'username',value:string){if(!value)return false;const norm=kind==='txid'||kind==='wallet'?value.toLowerCase():value.replace(/^@/,'').toLowerCase();const r:any=await env.DB.prepare('SELECT id FROM risk_blacklist WHERE kind=? AND lower(value)=? LIMIT 1').bind(kind,norm).first();return !!r;}
async function notifyAdmins(env:Env,kind:string,text:string,refId=''){
  const keyMap:Record<string,string>={order:'notify_new_orders',crypto:'notify_crypto_payments',low_stock:'notify_low_stock',payment_issue:'notify_payment_issues'};
  if(keyMap[kind]&&!(await featureEnabled(env,keyMap[kind],true)))return;
  try{await env.DB.prepare('INSERT INTO admin_notification_log(kind,ref_id,message) VALUES(?,?,?)').bind(kind,refId||null,text.slice(0,2000)).run();}catch{}
  for(const a of admins(env)){try{await send(env,a,text);}catch{}}
}
function referralTier(success:number,settings:{silver:number;gold:number;sm:number;gm:number}){if(success>=settings.gold)return {name:'Gold',emoji:'🥇',mult:settings.gm};if(success>=settings.silver)return {name:'Silver',emoji:'🥈',mult:settings.sm};return {name:'Bronze',emoji:'🥉',mult:1};}
async function referralSettings(env:Env){return {trigger:(await getSetting(env,'referral_reward_trigger','join')).toLowerCase(),amount:Number(await getSetting(env,'referral_reward_amount',env.REFERRAL_REWARD||'0.05'))||0.05,silver:Number(await getSetting(env,'referral_silver_threshold','10'))||10,gold:Number(await getSetting(env,'referral_gold_threshold','50'))||50,sm:Number(await getSetting(env,'referral_silver_multiplier','1.25'))||1.25,gm:Number(await getSetting(env,'referral_gold_multiplier','1.5'))||1.5};}
async function rewardReferral(env:Env,invitee:number,reason:'join'|'first_purchase'){
  if(!(await featureEnabled(env,'feature_referral',true)))return;
  const rs=await referralSettings(env);if(rs.trigger!==reason)return;
  const r:any=await env.DB.prepare("SELECT * FROM referrals WHERE invitee_telegram_id=? AND status='pending'").bind(invitee).first();if(!r)return;
  const inviterAccess=await getUserAccess(env,Number(r.inviter_telegram_id));if(Number(inviterAccess.referral_disabled))return;
  if(reason==='join'){const u:any=await env.DB.prepare('SELECT join_verified FROM users WHERE telegram_id=?').bind(invitee).first();if(!u?.join_verified)return;}
  const c:any=await env.DB.prepare("SELECT COUNT(*) c FROM referrals WHERE inviter_telegram_id=? AND status='rewarded'").bind(r.inviter_telegram_id).first();const tier=referralTier(Number(c?.c||0),rs);const reward=Number((rs.amount*tier.mult).toFixed(4));
  try{await env.DB.batch([env.DB.prepare("UPDATE referrals SET status='rewarded',reward=?,rewarded_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(reward,r.id),env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT ?,?,'referral','referral',?,'پاداش معرفی کاربر' WHERE EXISTS(SELECT 1 FROM referrals WHERE id=? AND status='rewarded') AND NOT EXISTS(SELECT 1 FROM credit_ledger WHERE kind='referral' AND ref_type='referral' AND ref_id=?)").bind(r.inviter_telegram_id,reward,String(r.id),r.id,String(r.id))]);}catch{}
}
async function getRate(env:Env,pair:string){const p=pair.toUpperCase();const q:any=await env.DB.prepare('SELECT * FROM rate_quotes WHERE pair=?').bind(p).first();return q?Number(q.rate||0):0;}
async function setRateQuote(env:Env,pair:string,rate:number,source:string,mode='auto'){if(!Number.isFinite(rate)||rate<=0)return;await env.DB.prepare("INSERT INTO rate_quotes(pair,rate,source,mode,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(pair) DO UPDATE SET rate=excluded.rate,source=excluded.source,mode=excluded.mode,updated_at=CURRENT_TIMESTAMP").bind(pair.toUpperCase(),rate,source,mode).run();}
async function refreshRates(env:Env,force=false){
  const ton=await refreshTonRate(env,force);if(ton)await setRateQuote(env,'TONUSD',ton,'CoinGecko','auto');
  const mode=(await getSetting(env,'rate_usd_try_mode','auto')).toLowerCase();if(mode==='auto'){try{const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY',{headers:{accept:'application/json'}});if(r.ok){const d:any=await r.json();const v=Number(d?.rates?.TRY||0);if(v>0)await setRateQuote(env,'USDTRY',v,'Frankfurter','auto');}}catch{}}
  const irrMode=(await getSetting(env,'rate_usd_irr_mode','manual')).toLowerCase();if(irrMode==='manual'){const v=Number(await getSetting(env,'rate_usd_irr_manual','0'));if(v>0)await setRateQuote(env,'USDIRR',v,'manual','manual');}
  const tryMode=(await getSetting(env,'rate_usd_try_mode','auto')).toLowerCase();if(tryMode==='manual'){const v=Number(await getSetting(env,'rate_usd_try_manual','0'));if(v>0)await setRateQuote(env,'USDTRY',v,'manual','manual');}
}
async function fetchTonRateSource(url:string,extract:(d:any)=>number,headers:any={accept:'application/json'}){
  try{const r=await fetch(url,{headers});const raw=await r.text();let d:any=null;try{d=JSON.parse(raw)}catch{}const rate=Number(extract(d)||0);return {ok:r.ok&&Number.isFinite(rate)&&rate>0,rate,status:r.status,message:r.ok?(rate>0?String(rate):'invalid_rate'):`HTTP ${r.status}`};}
  catch(e:any){return {ok:false,rate:0,status:0,message:String(e?.message||e).slice(0,120)};}
}
async function tonRateProviders(){
  const cg=await fetchTonRateSource('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',d=>Number(d?.['the-open-network']?.usd||0),{'accept':'application/json','user-agent':'Nexora-Commerce-Bot/0.7.4'});if(cg.ok)return {rate:cg.rate,source:'CoinGecko',details:`CoinGecko ${cg.rate}`};
  const bn=await fetchTonRateSource('https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT',d=>Number(d?.price||0));if(bn.ok)return {rate:bn.rate,source:'Binance',details:`Binance ${bn.rate}`};
  const bn2=await fetchTonRateSource('https://api.binance.com/api/v3/avgPrice?symbol=TONUSDT',d=>Number(d?.price||0));if(bn2.ok)return {rate:bn2.rate,source:'BinanceAvg',details:`BinanceAvg ${bn2.rate}`};
  return {rate:0,source:'',details:`CoinGecko ${cg.message}; Binance ${bn.message}; BinanceAvg ${bn2.message}`};
}
async function refreshTonRate(env:Env,force=false){
  const mode=(await getSetting(env,'ton_rate_mode','auto')).toLowerCase();
  if(mode!=='auto'&&!force)return null;
  const lastRaw=await getSetting(env,'ton_usd_rate_updated_at','');
  const last=lastRaw?Date.parse(lastRaw):0;
  if(!force&&last&&Date.now()-last<10*60*1000){const cached=Number(await getSetting(env,'ton_usd_rate_auto','0'))||0;return cached||null;}
  const hit=await tonRateProviders();
  if(hit.rate>0){await env.DB.batch([
    env.DB.prepare("INSERT INTO bot_settings(key,value) VALUES('ton_usd_rate_auto',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(hit.rate)),
    env.DB.prepare("INSERT INTO bot_settings(key,value) VALUES('ton_usd_rate_updated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(nowIso()),
    env.DB.prepare("INSERT INTO bot_settings(key,value) VALUES('ton_usd_rate_source',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(hit.source)
  ]);return hit.rate;}
  console.log('TON rate refresh failed',hit.details);return null;
}
async function effectiveTonRate(env:Env){
  const mode=(await getSetting(env,'ton_rate_mode','auto')).toLowerCase();
  const manual=Number(await getSetting(env,'ton_usd_rate',env.TON_USD_RATE||'0'))||0;
  if(mode==='manual')return manual;
  const auto=Number(await getSetting(env,'ton_usd_rate_auto','0'))||0;
  if(auto>0)return auto;
  const fresh=await refreshTonRate(env,true); return fresh||manual;
}
function bep20Token(env:Env){return String(env.USDT_BEP20_TOKEN||BSC_USDT_CONTRACT).trim();}
async function bep20Status(env:Env){
  const wallet=await getSetting(env,'wallet_bep20',env.USDT_BEP20_WALLET||'');
  const token=bep20Token(env),chain=String(env.ETHERSCAN_CHAIN_ID||BSC_MAINNET_CHAIN_ID).trim();
  const testMode=await featureEnabled(env,'bep20_test_mode',true);
  const enabled=await featureEnabled(env,'feature_bep20',true);
  const walletOk=/^0x[a-fA-F0-9]{40}$/.test(wallet);
  const tokenOk=normEvm(token)===normEvm(BSC_USDT_CONTRACT);
  const chainOk=chain===BSC_MAINNET_CHAIN_ID;
  const apiOk=!!env.ETHERSCAN_API_KEY;
  const rpcUrl=String(env.BSC_RPC_URL||DEFAULT_BSC_RPC).trim();
  const rpcOk=/^https:\/\//i.test(rpcUrl);
  return {wallet,token,chain,testMode,enabled,walletOk,tokenOk,chainOk,apiOk,rpcUrl,rpcOk,ready:enabled&&walletOk&&tokenOk&&chainOk&&rpcOk};
}
async function paymentConfig(env:Env){
  return {
    bep20: await getSetting(env,'wallet_bep20',env.USDT_BEP20_WALLET||''),
    trc20: await getSetting(env,'wallet_trc20',env.USDT_TRC20_WALLET||''),
    ton: await getSetting(env,'wallet_ton',env.TON_WALLET||''),
    tonRate: await effectiveTonRate(env),
    card: await getSetting(env,'card_number',env.CARD_NUMBER||''),
    cardHolder: await getSetting(env,'card_holder',env.CARD_HOLDER||'')
  };
}
async function paymentMethods(env:Env,chat:number,mid:number,usd:number,credits:number){
  const token=`${usd}:${credits}`; const cfg=await paymentConfig(env); const rows:Btn[][]=[];
  if(await featureEnabled(env,'feature_crypto',true)){const b=await bep20Status(env);if(b.ready&&(!b.testMode||isAdmin(env,chat)))rows.push([{text:b.testMode?'🧪 USDT (BEP20) — حالت تست':'🟡 USDT (BEP20) — خودکار',callback_data:`pay:crypto:BEP20:${token}`}]);if(cfg.trc20)rows.push([{text:'🔴 USDT (TRC20) — خودکار',callback_data:`pay:crypto:TRC20:${token}`}]);if(cfg.ton&&cfg.tonRate>0)rows.push([{text:'💎 TON — خودکار',callback_data:`pay:crypto:TON:${token}`}]);}
  if(await featureEnabled(env,'feature_card',true)&&cfg.card)rows.push([{text:'🏦 کارت به کارت — تأیید دستی',callback_data:`pay:card:${token}`}]);
  rows.push([{text:'⬅️ بازگشت',callback_data:'credit:buy'}]);
  await edit(env,chat,mid,`💳 <b>انتخاب روش پرداخت</b>\n\n💵 مبلغ: <b>$${usd.toFixed(2)}</b>\n💎 اعتبار دریافتی: <b>${credits.toFixed(2)}</b>`,rows);
}
async function createCryptoInvoice(env:Env,uid:number,usd:number,credits:number,network:string){
  const cfg=await paymentConfig(env); const net=network.toUpperCase();
  let asset='USDT', destination='', base=usd, precision=3;
  if(net==='BEP20'){const b=await bep20Status(env);if(!b.ready)throw new Error('BEP20 آماده نیست؛ Wallet/API/Chain/Contract را بررسی کن');destination=b.wallet;}
  else if(net==='TRC20')destination=cfg.trc20;
  else if(net==='TON'){destination=cfg.ton;asset='TON'; if(cfg.tonRate<=0)throw new Error('TON rate is not configured'); base=usd/cfg.tonRate; precision=4;}
  else throw new Error('Unsupported network');
  if(!destination)throw new Error('Wallet is not configured');
  let expected=0;
  for(let i=0;i<20;i++){
    const salt=net==='TON'?(secureRandomInt(8999)+1000)/100000:(secureRandomInt(899)+100)/1000;
    expected=Number((base+salt).toFixed(precision));
    const dup:any=await env.DB.prepare("SELECT id FROM payment_invoices WHERE method='crypto' AND network=? AND asset=? AND status='pending' AND expected_amount=? AND datetime(expires_at)>datetime('now')").bind(net,asset,expected).first();
    if(!dup)break;
  }
  const id=publicId('P'); const exp=new Date(Date.now()+Number(env.INVOICE_EXPIRE_MINUTES||30)*60000).toISOString();
  await env.DB.prepare("INSERT INTO payment_invoices(public_id,telegram_id,method,network,asset,requested_usd,credit_amount,expected_amount,destination,status,expires_at) VALUES(?,?,'crypto',?,?,?,?,?,?, 'pending',?)")
    .bind(id,uid,net,asset,usd,credits,expected,destination,exp).run();
  return {id,expected,exp,network:net,asset,destination,precision};
}
async function createCardInvoice(env:Env,uid:number,usd:number,credits:number){
  const id=publicId('C'); const exp=new Date(Date.now()+60*60000).toISOString();
  await env.DB.prepare("INSERT INTO payment_invoices(public_id,telegram_id,method,requested_usd,credit_amount,status,expires_at) VALUES(?,?,'card',?,?,'awaiting_receipt',?)").bind(id,uid,usd,credits,exp).run();
  await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`await_card_receipt:${id}`,uid).run();
  return {id,exp};
}
async function showCryptoInvoice(env:Env,chat:number,mid:number,uid:number,usd:number,credits:number,network:string){
  let inv:any; try{inv=await createCryptoInvoice(env,uid,usd,credits,network);}catch(e:any){return edit(env,chat,mid,`❌ روش پرداخت آماده نیست.\n\n${esc(String(e?.message||e))}`,[[{text:'⬅️ بازگشت',callback_data:'credit:buy'}]]);}
  const netLabel=inv.network==='BEP20'?'BSC / BEP20':inv.network==='TRC20'?'TRON / TRC20':'TON';
  const emoji=inv.network==='BEP20'?'🟡':inv.network==='TRC20'?'🔴':'💎';
  const amount=Number(inv.expected).toFixed(inv.precision);
  const t=`${emoji} <b>پرداخت ${inv.asset} روی ${inv.network}</b>\n\n🧾 فاکتور: <code>${inv.id}</code>\n💵 ارزش سفارش: $${usd.toFixed(2)}\n💰 <b>مبلغ دقیق قابل ارسال: ${amount} ${inv.asset}</b>\n\n🌐 شبکه: <b>${netLabel}</b>\n📬 آدرس مقصد:\n<code>${esc(inv.destination)}</code>\n\n⚠️ مبلغ را دقیق بفرست و فقط از شبکه مشخص‌شده استفاده کن.\n⏱ فاکتور حدود ${env.INVOICE_EXPIRE_MINUTES||30} دقیقه اعتبار دارد.\n\nسیستم به‌صورت خودکار بلاکچین را بررسی می‌کند.`;
  await edit(env,chat,mid,t,[
    [{text:'📋 کپی آدرس',copy_text:{text:inv.destination}},{text:'📋 کپی مبلغ',copy_text:{text:amount}}],
    [{text:'📷 نمایش QR',callback_data:`pay:qr:${inv.id}`}],
    [{text:'✨ پرداخت کردم؛ بررسی کن',callback_data:`pay:check:${inv.id}`}],
    [{text:'❌ لغو فاکتور',callback_data:`pay:cancel:${inv.id}`}],[{text:'🏠 منوی اصلی',callback_data:'menu'}]
  ]);
}
async function showPaymentQr(env:Env,chat:number,uid:number,pub:string){
  const inv:any=await env.DB.prepare("SELECT * FROM payment_invoices WHERE public_id=? AND telegram_id=? AND method='crypto'").bind(pub,uid).first(); if(!inv){await send(env,chat,'❌ فاکتور پیدا نشد.');return;}
  const payload=encodeURIComponent(String(inv.destination)); const url=`https://quickchart.io/qr?text=${payload}&size=350`;
  const precision=inv.network==='TON'?4:3;
  await tg(env,'sendPhoto',{chat_id:chat,photo:url,caption:`📷 QR آدرس ${inv.network}\n\nفاکتور: ${pub}\nمبلغ دقیق: ${Number(inv.expected_amount).toFixed(precision)} ${inv.asset}\n\n⚠️ QR فقط آدرس را نشان می‌دهد؛ مبلغ را دقیق و جداگانه وارد کن.`});
}
async function showCardInvoice(env:Env,chat:number,mid:number,uid:number,usd:number,credits:number){
  const inv=await createCardInvoice(env,uid,usd,credits); const cfg=await paymentConfig(env);
  const t=`🏦 <b>کارت به کارت</b>\n\n🧾 فاکتور: <code>${inv.id}</code>\n💵 مبلغ معادل دلاری: <b>$${usd.toFixed(2)}</b>\n💎 اعتبار: <b>${credits.toFixed(2)}</b>\n\n💳 شماره کارت:\n<code>${esc(cfg.card)}</code>\n👤 به نام: <b>${esc(cfg.cardHolder)}</b>\n\nپس از واریز، <b>تصویر یا فایل رسید</b> را همین‌جا ارسال کن. سفارش برای ادمین می‌رود و پس از تأیید دستی اعتبارت اضافه می‌شود.`;
  await edit(env,chat,mid,t,[[{text:'📋 کپی شماره کارت',copy_text:{text:cfg.card}}],[{text:'❌ لغو',callback_data:`pay:cancel:${inv.id}`}],[{text:'🏠 منوی اصلی',callback_data:'menu'}]]);
}

type ChainTransfer={hash:string;from?:string;to:string;amount:number;ts:number;ok:boolean;confirmations?:number;contract?:string;blockNumber?:number};
type ProviderCheck={ok:boolean;http?:number;message:string;detail?:string};
async function etherscanBscCheck(env:Env,wallet?:string):Promise<ProviderCheck>{
  if(!env.ETHERSCAN_API_KEY)return {ok:false,message:'API key وارد نشده'};
  try{
    const u=new URL('https://api.etherscan.io/v2/api');
    u.searchParams.set('chainid',BSC_MAINNET_CHAIN_ID);u.searchParams.set('module','proxy');u.searchParams.set('action','eth_blockNumber');u.searchParams.set('apikey',String(env.ETHERSCAN_API_KEY));
    const r=await fetch(u.toString(),{headers:{accept:'application/json'}});const raw=await r.text();let d:any=null;try{d=JSON.parse(raw)}catch{}
    const result=String(d?.result||'');const msg=String(d?.message||'');
    const ok=r.ok&&/^0x[0-9a-f]+$/i.test(result);
    return {ok,http:r.status,message:ok?'Etherscan V2 / BSC پاسخ معتبر داد':(msg||result||raw||`HTTP ${r.status}`).slice(0,220),detail:wallet?`wallet=${wallet.slice(0,8)}…`:undefined};
  }catch(e:any){return {ok:false,message:String(e?.message||e).slice(0,220)};}
}
async function bscRpcCall(env:Env,method:string,params:any[]):Promise<any>{
  const url=String(env.BSC_RPC_URL||DEFAULT_BSC_RPC).trim();
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const raw=await r.text();let d:any=null;try{d=JSON.parse(raw)}catch{}
  if(!r.ok)throw new Error(`HTTP ${r.status}: ${raw.slice(0,160)}`);
  if(d?.error)throw new Error(String(d.error?.message||JSON.stringify(d.error)).slice(0,180));
  return d?.result;
}
async function bscRpcCheck(env:Env):Promise<ProviderCheck>{
  try{const x=await bscRpcCall(env,'eth_blockNumber',[]);const ok=/^0x[0-9a-f]+$/i.test(String(x||''));return {ok,message:ok?`BSC RPC آنلاین — block ${parseInt(String(x),16)}`:`پاسخ نامعتبر: ${String(x).slice(0,160)}`};}
  catch(e:any){return {ok:false,message:String(e?.message||e).slice(0,220)};}
}
async function fetchBep20Etherscan(env:Env,wallet:string):Promise<{ok:boolean;items:ChainTransfer[];message:string}>{
  if(!env.ETHERSCAN_API_KEY)return {ok:false,items:[],message:'missing api key'};
  const u=new URL('https://api.etherscan.io/v2/api');u.searchParams.set('chainid',BSC_MAINNET_CHAIN_ID);u.searchParams.set('module','account');u.searchParams.set('action','tokentx');
  u.searchParams.set('contractaddress',BSC_USDT_CONTRACT);u.searchParams.set('address',wallet);u.searchParams.set('page','1');u.searchParams.set('offset','150');u.searchParams.set('sort','desc');u.searchParams.set('apikey',String(env.ETHERSCAN_API_KEY));
  try{
    const r=await fetch(u.toString(),{headers:{accept:'application/json'}});const raw=await r.text();let d:any=null;try{d=JSON.parse(raw)}catch{}
    const arr=Array.isArray(d?.result)?d.result:[];const text=String(d?.result||d?.message||raw||'');
    const noTx=/no transactions found/i.test(text)||(/NOTOK/i.test(String(d?.message||''))&&Array.isArray(d?.result)&&d.result.length===0);
    const ok=r.ok&&(String(d?.status)==='1'||Array.isArray(d?.result)||noTx);
    if(!ok)return {ok:false,items:[],message:(String(d?.result||d?.message||raw||`HTTP ${r.status}`)).slice(0,220)};
    const items=arr.filter((x:any)=>normEvm(String(x.contractAddress||''))===normEvm(BSC_USDT_CONTRACT)&&normEvm(String(x.to||''))===normEvm(wallet)&&String(x.isError||'0')!=='1'&&Number(x.blockNumber||0)>0).map((x:any)=>({hash:String(x.hash||''),from:String(x.from||''),to:String(x.to||''),amount:Number(x.value)/10**Number(x.tokenDecimal||18),ts:Number(x.timeStamp||0)*1000,ok:true,confirmations:Number(x.confirmations||0),contract:String(x.contractAddress||''),blockNumber:Number(x.blockNumber||0)}));
    return {ok:true,items,message:items.length?`${items.length} transfer found`:'connected; no matching transfers'};
  }catch(e:any){return {ok:false,items:[],message:String(e?.message||e).slice(0,220)};}
}
async function fetchBep20Rpc(env:Env,wallet:string):Promise<ChainTransfer[]>{
  const latestHex=await bscRpcCall(env,'eth_blockNumber',[]);const latest=parseInt(String(latestHex),16);if(!Number.isFinite(latest))throw new Error('invalid latest block');
  const from=Math.max(0,latest-4500);const topicTo='0x'+wallet.toLowerCase().replace(/^0x/,'').padStart(64,'0');
  const logs:any[]=await bscRpcCall(env,'eth_getLogs',[{fromBlock:'0x'+from.toString(16),toBlock:'latest',address:BSC_USDT_CONTRACT,topics:[ERC20_TRANSFER_TOPIC,null,topicTo]}])||[];
  const selected=logs.slice(-150).reverse();const blocks=new Map<number,number>();
  for(const l of selected){const bn=parseInt(String(l.blockNumber||'0x0'),16);if(bn&&!blocks.has(bn)){try{const b=await bscRpcCall(env,'eth_getBlockByNumber',['0x'+bn.toString(16),false]);blocks.set(bn,parseInt(String(b?.timestamp||'0x0'),16)*1000);}catch{blocks.set(bn,0);}}}
  return selected.map((l:any)=>{const bn=parseInt(String(l.blockNumber||'0x0'),16);let amount=0;try{amount=Number(BigInt(String(l.data||'0x0')))/1e18}catch{}return {hash:String(l.transactionHash||''),from:'',to:wallet,amount,ts:blocks.get(bn)||0,ok:true,confirmations:Math.max(0,latest-bn+1),contract:BSC_USDT_CONTRACT,blockNumber:bn};});
}
async function fetchBep20Transfers(env:Env,wallet:string):Promise<ChainTransfer[]>{
  const st=await bep20Status(env);if(!st.ready||normEvm(wallet)!==normEvm(st.wallet))return [];
  const es=await fetchBep20Etherscan(env,wallet);if(es.ok)return es.items;
  console.log('Etherscan BSC scanner unavailable, using RPC fallback:',es.message);
  try{return await fetchBep20Rpc(env,wallet);}catch(e){console.log('BSC RPC fallback failed',String(e));return []}
}
async function fetchTrc20Transfers(env:Env,wallet:string):Promise<ChainTransfer[]>{
  if(!wallet||!env.USDT_TRC20_TOKEN)return [];
  const u=new URL(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(wallet)}/transactions/trc20`); u.searchParams.set('only_confirmed','true');u.searchParams.set('limit','200');u.searchParams.set('contract_address',env.USDT_TRC20_TOKEN);
  const headers:any={}; if(env.TRONGRID_API_KEY)headers['TRON-PRO-API-KEY']=env.TRONGRID_API_KEY;
  try{const r=await fetch(u.toString(),{headers});const d:any=await r.json();return (Array.isArray(d.data)?d.data:[]).map((x:any)=>({hash:String(x.transaction_id||''),from:String(x.from||''),to:String(x.to||''),amount:Number(x.value)/10**Number(x.token_info?.decimals||6),ts:Number(x.block_timestamp||0),ok:true,confirmations:1}));}catch{return []}
}
async function fetchTonTransfers(env:Env,wallet:string):Promise<ChainTransfer[]>{
  if(!wallet)return [];
  const headers:any={accept:'application/json'}; if(env.TONAPI_API_KEY)headers.Authorization=`Bearer ${env.TONAPI_API_KEY}`;
  try{
    let normalized=wallet; const ar=await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}`,{headers}); if(ar.ok){const ad:any=await ar.json();normalized=String(ad.address||wallet);}
    const r=await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}/events?limit=100`,{headers});const d:any=await r.json();const out:ChainTransfer[]=[];
    for(const ev of (d.events||[])){for(const a of (ev.actions||[])){const tt=a.TonTransfer||a.ton_transfer;if(!tt)continue;const dest=String(tt.recipient?.address||tt.recipient?.account_address||'');if(dest!==wallet&&dest!==normalized)continue;const amount=Number(tt.amount||0)/1e9;out.push({hash:String(ev.event_id||''),from:String(tt.sender?.address||tt.sender?.account_address||''),to:wallet,amount,ts:Number(ev.timestamp||0)*1000,ok:String(ev.status||'ok').toLowerCase()!=='failed',confirmations:1});}}return out;
  }catch{return []}
}

type MethodDiagnostic={name:string;ok:boolean;lines:string[]};
function okMark(v:boolean){return v?'✅':'❌';}
function maskSecret(v?:string){if(!v)return 'ندارد';return v.length<=8?'••••':`${v.slice(0,4)}…${v.slice(-4)}`;}
async function diagnoseBep20(env:Env):Promise<MethodDiagnostic>{
  const b=await bep20Status(env);const es=await etherscanBscCheck(env,b.wallet);const rpc=await bscRpcCheck(env);const providerOk=es.ok||rpc.ok;
  return {name:'BEP20 / BSC',ok:b.walletOk&&b.tokenOk&&b.chainOk&&providerOk,lines:[
    `${okMark(b.walletOk)} Wallet: ${b.walletOk?'معتبر':'نامعتبر/تنظیم نشده'}`,
    `${okMark(b.tokenOk)} USDT contract whitelist: ${b.tokenOk?'صحیح':'اشتباه'}`,
    `${okMark(b.chainOk)} Chain ID: ${b.chain||'—'} ${b.chainOk?'':'(باید 56 باشد)'}`,
    `${es.ok?'✅':'⚠️'} Etherscan V2: ${es.message}`,
    `${rpc.ok?'✅':'❌'} BSC RPC fallback: ${rpc.message}`,
    `🔑 Etherscan key: ${maskSecret(env.ETHERSCAN_API_KEY)}`,
    `🧪 Mode: ${b.testMode?'TEST':'LIVE'}`
  ]};
}
async function diagnoseTrc20(env:Env):Promise<MethodDiagnostic>{
  const wallet=await getSetting(env,'wallet_trc20',env.USDT_TRC20_WALLET||'');const token=String(env.USDT_TRC20_TOKEN||'').trim();
  const walletOk=/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(wallet);const tokenOk=token===TRON_USDT_CONTRACT;let apiOk=false,msg='بررسی نشد';
  if(walletOk&&tokenOk){try{const u=new URL(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(wallet)}/transactions/trc20`);u.searchParams.set('only_confirmed','true');u.searchParams.set('only_to','true');u.searchParams.set('limit','1');u.searchParams.set('contract_address',token);const h:any={accept:'application/json'};if(env.TRONGRID_API_KEY)h['TRON-PRO-API-KEY']=env.TRONGRID_API_KEY;const r=await fetch(u.toString(),{headers:h});const raw=await r.text();let d:any=null;try{d=JSON.parse(raw)}catch{}apiOk=r.ok&&d?.success!==false&&!d?.Error;msg=apiOk?`TronGrid پاسخ معتبر داد${Array.isArray(d?.data)?` — ${d.data.length} رکورد نمونه`:''}`:String(d?.Error||d?.error||d?.message||raw||`HTTP ${r.status}`).slice(0,220);}catch(e:any){msg=String(e?.message||e).slice(0,220);}}
  return {name:'TRC20 / TRON',ok:walletOk&&tokenOk&&apiOk,lines:[`${okMark(walletOk)} Wallet: ${walletOk?'معتبر':'نامعتبر/تنظیم نشده'}`,`${okMark(tokenOk)} USDT contract: ${tokenOk?'رسمی/صحیح':'اشتباه یا تنظیم نشده'}`,`${apiOk?'✅':'❌'} TronGrid: ${msg}`,`${env.TRONGRID_API_KEY?'✅':'⚠️'} API key: ${env.TRONGRID_API_KEY?maskSecret(env.TRONGRID_API_KEY):'تنظیم نشده — برای production توصیه می‌شود'}`]};
}
async function diagnoseTon(env:Env):Promise<MethodDiagnostic>{
  const wallet=await getSetting(env,'wallet_ton',env.TON_WALLET||'');const walletOk=/^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(wallet)||/^0:[0-9a-fA-F]{64}$/.test(wallet);const headers:any={accept:'application/json'};if(env.TONAPI_API_KEY)headers.Authorization=`Bearer ${env.TONAPI_API_KEY}`;let apiOk=false,accountOk=false,msg='بررسی نشد';
  try{const r=await fetch('https://tonapi.io/v2/blockchain/masterchain-head',{headers});const raw=await r.text();apiOk=r.ok;msg=apiOk?`TonAPI آنلاین (HTTP ${r.status})`:String(raw||`HTTP ${r.status}`).slice(0,220);}catch(e:any){msg=String(e?.message||e).slice(0,220);}
  if(walletOk){try{const r=await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(wallet)}`,{headers});accountOk=r.ok;if(!accountOk){const raw=await r.text();msg+=` | account: ${raw.slice(0,120)}`;}}catch{accountOk=false;}}
  const rate=await effectiveTonRate(env);const rateOk=Number(rate)>0;
  return {name:'TON',ok:walletOk&&apiOk&&accountOk&&rateOk,lines:[`${okMark(walletOk)} Wallet: ${walletOk?'فرمت معتبر':'نامعتبر/تنظیم نشده'}`,`${apiOk?'✅':'❌'} TonAPI: ${msg}`,`${accountOk?'✅':'❌'} Wallet lookup: ${accountOk?'موفق':'ناموفق'}`,`${env.TONAPI_API_KEY?'✅':'⚠️'} API key: ${env.TONAPI_API_KEY?maskSecret(env.TONAPI_API_KEY):'ندارد — حالت بدون کلید rate-limit پایین‌تری دارد'}`,`${okMark(rateOk)} TON/USD rate: ${rateOk?Number(rate).toFixed(4):'تنظیم نشده'}`]};
}
async function diagnoseCard(env:Env):Promise<MethodDiagnostic>{
  const cfg=await paymentConfig(env);const digits=String(cfg.card||'').replace(/\D/g,'');const numberOk=digits.length>=16&&digits.length<=19;const holderOk=String(cfg.cardHolder||'').trim().length>=2;const feature=await featureEnabled(env,'feature_card',true);
  return {name:'کارت به کارت',ok:feature&&numberOk&&holderOk,lines:[`${okMark(feature)} Feature: ${feature?'فعال':'غیرفعال'}`,`${okMark(numberOk)} شماره کارت: ${numberOk?`•••• ${digits.slice(-4)}`:'نامعتبر/تنظیم نشده'}`,`${okMark(holderOk)} صاحب کارت: ${holderOk?cfg.cardHolder:'تنظیم نشده'}`,'ℹ️ این روش تأیید دستی است و API بانکی ندارد.']};
}
async function diagnoseRates(env:Env):Promise<MethodDiagnostic>{
  const provider=await tonRateProviders();let fr=false,frMsg='';
  try{const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY',{headers:{accept:'application/json'}});const d:any=await r.json().catch(()=>null);fr=r.ok&&Number(d?.rates?.TRY)>0;frMsg=fr?`USD/TRY=${Number(d.rates.TRY)}`:`HTTP ${r.status}`;}catch(e:any){frMsg=String(e?.message||e).slice(0,120);}
  const cached=Number(await getSetting(env,'ton_usd_rate_auto','0'))||0;const source=await getSetting(env,'ton_usd_rate_source','');const manualTon=Number(await getSetting(env,'ton_usd_rate',env.TON_USD_RATE||'0'))||0;const irr=Number(await getSetting(env,'rate_usd_irr_manual','0'))||0;
  const tonOperational=provider.rate>0||cached>0||manualTon>0;const tonLine=provider.rate>0?`✅ TON/USD live: ${provider.rate.toFixed(4)} (${provider.source})`:cached>0?`⚠️ TON/USD cached: ${cached.toFixed(4)}${source?` (${source})`:''}`:manualTon>0?`⚠️ TON/USD manual fallback: ${manualTon.toFixed(4)}`:`❌ TON/USD: هیچ منبع معتبری موجود نیست`;
  return {name:'Rate Engine',ok:tonOperational&&fr,lines:[tonLine,provider.rate>0?'✅ Provider fallback chain: عملیاتی':`⚠️ Provider live: ${provider.details}`,`${fr?'✅':'❌'} Frankfurter: ${frMsg}`,`${irr>0?'✅':'⚠️'} USD/IRR manual: ${irr>0?irr:'تنظیم نشده'}`]};
}
async function paymentDiagnostics(env:Env,which='all'){const out:MethodDiagnostic[]=[];if(which==='all'||which==='bep20')out.push(await diagnoseBep20(env));if(which==='all'||which==='trc20')out.push(await diagnoseTrc20(env));if(which==='all'||which==='ton')out.push(await diagnoseTon(env));if(which==='all'||which==='card')out.push(await diagnoseCard(env));if(which==='all'||which==='rates')out.push(await diagnoseRates(env));return out;}
function diagnosticsTelegramText(items:MethodDiagnostic[]){let t='🧪 <b>تست روش‌های پرداخت</b>\n';for(const x of items){t+=`\n${x.ok?'✅':'❌'} <b>${esc(x.name)}</b>\n${x.lines.map(v=>esc(v)).join('\n')}\n`;}return t.slice(0,3900);}
function diagnosticsHtml(items:MethodDiagnostic[]){return `<div class="card" style="margin-top:14px"><h3>🧪 نتیجه تست</h3>${items.map(x=>`<div style="padding:10px 0;border-bottom:1px solid #24314e"><b>${x.ok?'✅':'❌'} ${webEsc(x.name)}</b><div class="muted" style="white-space:pre-wrap;margin-top:7px">${x.lines.map(webEsc).join('<br>')}</div></div>`).join('')}</div>`;}

function sameDest(network:string,a:string,b:string){if(network==='TON')return true;return network==='BEP20'?a.toLowerCase()===b.toLowerCase():a===b;}
async function settleCrypto(env:Env,invoice:any,tx:ChainTransfer){
  const txHash=String(tx.hash||'').toLowerCase(); if(!txHash||!tx.ok)return false;
  const reqConf=Number(await getSetting(env,`confirmations_${String(invoice.network).toLowerCase()}`,invoice.network==='BEP20'?'5':'1'))||1;if((tx.confirmations??0)<reqConf)return false;
  if(String(invoice.network)==='BEP20'){const bs=await bep20Status(env);if(!bs.ready||bs.testMode||normEvm(String(tx.contract||''))!==normEvm(BSC_USDT_CONTRACT)||!tx.blockNumber)return false;}
  if(!sameDest(String(invoice.network),String(tx.to||''),String(invoice.destination||'')))return false;
  if(Math.abs(Number(tx.amount)-Number(invoice.expected_amount))>(invoice.network==='TON'?0.00000001:0.0000001))return false;
  const created=Date.parse(invoice.created_at||'')||0; if(tx.ts&&created&&tx.ts<created)return false;
  const claim=randomHex(18),guard=`pay:${claim}`;
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO payment_settlements(invoice_id,claim_token,tx_hash,settlement_kind) SELECT id,?,?,'crypto' FROM payment_invoices WHERE id=? AND status='pending' AND datetime(expires_at)>datetime('now')").bind(claim,txHash,invoice.id),
    env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=? AND tx_hash=?) THEN 1 ELSE 0 END").bind(guard,invoice.id,claim,txHash),
    env.DB.prepare("UPDATE payment_invoices SET status='paid',tx_hash=?,paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(txHash,invoice.id,invoice.id,claim),
    env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT telegram_id,credit_amount,'topup','payment',public_id,? FROM payment_invoices WHERE id=? AND status='paid' AND tx_hash=? AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(`شارژ خودکار ${invoice.asset} ${invoice.network}`,invoice.id,txHash,invoice.id,claim),
    env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM credit_ledger WHERE kind='topup' AND ref_type='payment' AND ref_id=?) THEN 1 ELSE 0 END").bind(`${guard}:ledger`,invoice.public_id),
    env.DB.prepare('DELETE FROM security_guards WHERE tag IN (?,?)').bind(guard,`${guard}:ledger`)
  ]);}catch(e){console.log('crypto settlement rejected',invoice.public_id,String(e));return false;}
  await notifyAdmins(env,'crypto',`💰 <b>پرداخت کریپتو تأیید شد</b>\n\n🧾 <code>${invoice.public_id}</code>\n👤 <code>${invoice.telegram_id}</code>\n🌐 ${invoice.network}\n💵 $${Number(invoice.requested_usd).toFixed(2)}\n🔗 <code>${txHash}</code>`,invoice.public_id);
  await send(env,invoice.telegram_id,`✅ <b>پرداخت تأیید شد</b>

🧾 ${invoice.public_id}
🌐 ${invoice.network}
💎 <b>${Number(invoice.credit_amount).toFixed(2)} Credit</b> به موجودی‌ات اضافه شد.`,[[{text:'💰 مشاهده موجودی',callback_data:'balance'}]]); return true;
}
async function markPaymentIssue(env:Env,inv:any,tx:ChainTransfer,eventType:'late_payment'|'underpayment'|'overpayment'){
  const hash=String(tx.hash||'').toLowerCase();if(!hash)return false;
  try{await env.DB.batch([
    env.DB.prepare('INSERT INTO payment_events(invoice_id,public_id,telegram_id,event_type,network,tx_hash,expected_amount,detected_amount,confirmations,details) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(inv.id,inv.public_id,inv.telegram_id,eventType,inv.network,hash,Number(inv.expected_amount),Number(tx.amount),Number(tx.confirmations||0),`detected by scanner`),
    env.DB.prepare("UPDATE payment_invoices SET status='manual_review',tx_hash=? WHERE id=? AND status IN ('pending','expired')").bind(hash,inv.id)
  ]);}catch{return false;}
  const label=eventType==='late_payment'?'⏰ پرداخت دیرهنگام':eventType==='underpayment'?'📉 کم‌پرداخت':'📈 اضافه‌پرداخت';
  const text=`⚠️ <b>${label}</b>\n\n🧾 <code>${inv.public_id}</code>\n👤 <code>${inv.telegram_id}</code>\n🌐 ${inv.network}\nمورد انتظار: <b>${Number(inv.expected_amount).toFixed(inv.network==='TON'?4:3)} ${inv.asset}</b>\nدریافتی: <b>${Number(tx.amount).toFixed(inv.network==='TON'?4:3)} ${inv.asset}</b>\n🔗 <code>${hash}</code>`;
  if(await featureEnabled(env,'notify_payment_issues',true))for(const a of admins(env))await send(env,a,text,[[{text:'✅ تأیید و شارژ',callback_data:`admin:cryptoissue:approve:${inv.public_id}`},{text:'❌ رد',callback_data:`admin:cryptoissue:reject:${inv.public_id}`}]]);
  return true;
}
async function scanPendingCrypto(env:Env,onlyPublicId?:string,ownerTelegramId?:number){
  const grace=Math.max(0,Number(await getSetting(env,'payment_late_grace_minutes','1440'))||1440);
  const base="SELECT * FROM payment_invoices WHERE method='crypto' AND status IN ('pending','expired') AND datetime(created_at)>=datetime('now',?)";
  const window=`-${Math.max(grace+120,180)} minutes`;let st:D1PreparedStatement;
  if(onlyPublicId&&ownerTelegramId)st=env.DB.prepare(base+' AND public_id=? AND telegram_id=?').bind(window,onlyPublicId,ownerTelegramId);
  else if(onlyPublicId)st=env.DB.prepare(base+' AND public_id=?').bind(window,onlyPublicId);
  else st=env.DB.prepare(base+' ORDER BY id DESC LIMIT 250').bind(window);
  const q:any=await st.all(); const invoices=q.results||[]; if(!invoices.length)return 0;
  const grouped=new Map<string,any[]>();for(const inv of invoices){const key=`${inv.network}|${String(inv.destination||'')}`;const arr=grouped.get(key)||[];arr.push(inv);grouped.set(key,arr);}let n=0;
  for(const [key,invs] of grouped){const [network]=key.split('|');const wallet=String(invs[0].destination||'');let txs:ChainTransfer[]=[];if(network==='BEP20')txs=await fetchBep20Transfers(env,wallet);else if(network==='TRC20')txs=await fetchTrc20Transfers(env,wallet);else if(network==='TON')txs=await fetchTonTransfers(env,wallet);
    for(const inv of invs){const created=Date.parse(inv.created_at||'')||0;const expected=Number(inv.expected_amount||0);const nearPct=Math.max(0.1,Number(await getSetting(env,'payment_near_match_percent','2'))||2)/100;const nearAbs=Math.max(inv.network==='TON'?0.002:0.02,Math.abs(expected)*nearPct);const reqConf=Number(await getSetting(env,`confirmations_${String(inv.network).toLowerCase()}`,inv.network==='BEP20'?'5':'1'))||1;
      for(const tx of txs){if(!tx.ok||!sameDest(String(inv.network),String(tx.to||''),String(inv.destination||'')))continue;if(created&&tx.ts&&tx.ts<created)continue;const hash=String(tx.hash||'').toLowerCase();if(!hash)continue;if(await isBlacklisted(env,'txid',hash)||await isBlacklisted(env,'wallet',String(tx.from||''))){try{await env.DB.prepare("INSERT OR IGNORE INTO payment_events(invoice_id,public_id,telegram_id,event_type,network,tx_hash,expected_amount,detected_amount,confirmations,details) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(inv.id,inv.public_id,inv.telegram_id,'blacklisted_payment',inv.network,hash,expected,tx.amount,tx.confirmations||0,`source=${tx.from||''}`).run();}catch{}await notifyAdmins(env,'payment_issue',`🚫 <b>پرداخت Blacklist شده</b>\n\n🧾 <code>${inv.public_id}</code>\n🔗 <code>${hash}</code>\nFrom: <code>${esc(String(tx.from||'unknown'))}</code>`,inv.public_id);continue;}const used:any=await env.DB.prepare("SELECT 1 x FROM payment_settlements WHERE tx_hash=? UNION SELECT 1 x FROM payment_events WHERE tx_hash=? AND event_type IN ('late_payment','underpayment','overpayment') LIMIT 1").bind(hash,hash).first();if(used)continue;const diff=Number(tx.amount)-expected;const exact=Math.abs(diff)<=(inv.network==='TON'?0.00000001:0.0000001);
        if(exact&&Number(tx.confirmations||0)<reqConf){try{await env.DB.prepare("INSERT OR IGNORE INTO payment_events(invoice_id,public_id,telegram_id,event_type,network,tx_hash,expected_amount,detected_amount,confirmations,details) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(inv.id,inv.public_id,inv.telegram_id,'awaiting_confirmations',inv.network,hash,expected,tx.amount,tx.confirmations||0,`need ${reqConf}`).run();}catch{}continue;}
        if(exact&&inv.network==='BEP20'&&(await bep20Status(env)).testMode){try{await env.DB.prepare("INSERT OR IGNORE INTO payment_events(invoice_id,public_id,telegram_id,event_type,network,tx_hash,expected_amount,detected_amount,confirmations,details) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(inv.id,inv.public_id,inv.telegram_id,'bep20_test_detected',inv.network,hash,expected,tx.amount,tx.confirmations||0,'BEP20 test mode: detected but not credited').run();}catch{}await notifyAdmins(env,'payment_issue',`🧪 <b>تست BEP20 موفق بود</b>\n\n🧾 <code>${inv.public_id}</code>\n✅ Contract whitelist صحیح\n✅ مقصد صحیح\n✅ مبلغ صحیح\n✅ Confirmations: ${Number(tx.confirmations||0)}\n🔗 <code>${hash}</code>\n\nبرای پرداخت واقعی، BEP20 را از حالت تست خارج کن.`,inv.public_id);break;}
        if(exact&&inv.status==='pending'&&new Date(inv.expires_at||0).getTime()>Date.now()){if(await settleCrypto(env,inv,tx)){n++;break;}}
        else if(exact){if(await markPaymentIssue(env,inv,tx,'late_payment'))break;}
        else if(Math.abs(diff)<=nearAbs){if(await markPaymentIssue(env,inv,tx,diff<0?'underpayment':'overpayment'))break;}
      }
    }
  }
  return n;
}

async function notifyAdminsCardReceipt(env:Env,inv:any,user:TgUser,fileId:string,isDoc:boolean){
  const caption=`🏦 <b>رسید کارت به کارت جدید</b>\n\n🧾 <code>${inv.public_id}</code>\n👤 ${user.username?'@'+esc(user.username):esc(user.first_name||String(user.id))}\n🆔 <code>${user.id}</code>\n💵 $${Number(inv.requested_usd).toFixed(2)}\n💎 ${Number(inv.credit_amount).toFixed(2)} Credit`;
  const reply_markup={inline_keyboard:[[{text:'✅ تأیید',callback_data:`admin:card:approve:${inv.public_id}`},{text:'❌ رد',callback_data:`admin:card:reject:${inv.public_id}`}]]};
  for(const a of admins(env)){
    if(isDoc)await tg(env,'sendDocument',{chat_id:a,document:fileId,caption,parse_mode:'HTML',reply_markup}); else await tg(env,'sendPhoto',{chat_id:a,photo:fileId,caption,parse_mode:'HTML',reply_markup});
  }
}

async function showShop(env:Env,chat:number,mid?:number){
  const q:any=await env.DB.prepare("SELECT c.*,(SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.enabled=1) product_count FROM shop_categories c WHERE c.enabled=1 ORDER BY c.sort_order,c.id").all();
  const cats=(q.results||[]).filter((x:any)=>Number(x.product_count)>0); const rows:Btn[][]=cats.map((c:any)=>[{text:`${c.emoji||'🛍'} ${c.title} (${c.product_count})`,callback_data:`shop:cat:${c.id}:0`}]);
  rows.push([{text:'🧾 همه محصولات',callback_data:'shop:cat:0:0'}],[{text:'⬅️ منوی اصلی',callback_data:'menu'}]);
  const t=cats.length?'🛍 <b>فروشگاه</b>\n\nیک دسته‌بندی را انتخاب کن:':'🛍 <b>فروشگاه</b>\n\nفعلاً محصول فعالی ثبت نشده.';
  mid?await edit(env,chat,mid,t,rows):await send(env,chat,t,rows);
}
async function showCategoryProducts(env:Env,chat:number,mid:number,catId:number,page:number){
  const limit=8,off=page*limit; const where=catId?'p.enabled=1 AND p.category_id=?':'p.enabled=1';
  const st=catId?env.DB.prepare(`SELECT p.*,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p WHERE ${where} ORDER BY p.sort_order,p.id LIMIT ? OFFSET ?`).bind(catId,limit+1,off):env.DB.prepare(`SELECT p.*,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p WHERE ${where} ORDER BY p.sort_order,p.id LIMIT ? OFFSET ?`).bind(limit+1,off);
  const q:any=await st.all(); const arr=q.results||[]; const more=arr.length>limit; const items=arr.slice(0,limit); let title='همه محصولات';
  if(catId){const c:any=await env.DB.prepare('SELECT title,emoji FROM shop_categories WHERE id=?').bind(catId).first();if(c)title=`${c.emoji||'🛍'} ${c.title}`;}
  const rows:Btn[][]=items.map((p:any)=>[{text:`${p.title} — ${Number(p.price_credits).toFixed(2)} cr`,callback_data:`shop:p:${p.id}`}]);
  const nav:Btn[]=[];if(page>0)nav.push({text:'⬅️ قبلی',callback_data:`shop:cat:${catId}:${page-1}`});if(more)nav.push({text:'بعدی ➡️',callback_data:`shop:cat:${catId}:${page+1}`});if(nav.length)rows.push(nav);rows.push([{text:'⬅️ دسته‌بندی‌ها',callback_data:'shop:list'}]);
  await edit(env,chat,mid,`🛍 <b>${esc(title)}</b>\n\n${items.length?'محصول موردنظرت را انتخاب کن:':'محصولی در این بخش نیست.'}`,rows);
}
async function showProduct(env:Env,chat:number,mid:number,pid:number){
  const p:any=await env.DB.prepare("SELECT p.*,c.title category_title,c.emoji category_emoji,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p LEFT JOIN shop_categories c ON c.id=p.category_id WHERE p.id=? AND p.enabled=1").bind(pid).first();
  if(!p)return edit(env,chat,mid,'❌ محصول پیدا نشد.',[[{text:'⬅️ فروشگاه',callback_data:'shop:list'}]]);
  let t=`${p.category_emoji||'🛍'} <b>${esc(p.title)}</b>\n\n${esc(p.description||'')}\n\n💎 قیمت: <b>${Number(p.price_credits).toFixed(2)} Credit</b>\n📦 موجودی: <b>${p.stock}</b>`;
  if(p.warranty_text)t+=`\n🛡 ضمانت: <b>${esc(p.warranty_text)}</b>`; if(p.format_text)t+=`\n📋 فرمت تحویل: <b>${esc(p.format_text)}</b>`;
  const qtys=[1,2,3,5,10].filter(x=>x<=Number(p.stock)); const rows:Btn[][]=[]; if(qtys.length)rows.push(qtys.map(q=>({text:String(q),callback_data:`shop:summary:${p.id}:${q}:0`})));
  rows.push([{text:'⬅️ بازگشت',callback_data:p.category_id?`shop:cat:${p.category_id}:0`:'shop:list'}]); await edit(env,chat,mid,t,rows);
}
async function validDiscount(env:Env,id:number,subtotal:number){
  if(!id)return null; const d:any=await env.DB.prepare("SELECT * FROM discount_codes WHERE id=? AND enabled=1 AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(id).first(); if(!d)return null;
  if(Number(d.min_total||0)>subtotal)return null; if(d.max_uses!==null&&Number(d.uses_count)>=Number(d.max_uses))return null; return d;
}
function discountAmount(d:any,subtotal:number){if(!d)return 0; const x=d.discount_type==='percent'?subtotal*Number(d.value)/100:Number(d.value);return Math.max(0,Math.min(subtotal,x));}
async function showOrderSummary(env:Env,uid:number,chat:number,mid:number,pid:number,qty:number,discountId=0){
  const access=await getUserAccess(env,uid);
  const p:any=await env.DB.prepare("SELECT p.*,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p WHERE id=? AND enabled=1").bind(pid).first(); if(!p||qty<1||qty>Number(p.stock))return edit(env,chat,mid,'❌ موجودی کافی نیست.',[[{text:'⬅️ فروشگاه',callback_data:'shop:list'}]]);
  const subtotal=Number(p.price_credits)*qty; const d=await validDiscount(env,discountId,subtotal); const off=discountAmount(d,subtotal); const total=subtotal-off;if(access.purchase_limit!==null&&access.purchase_limit!==undefined&&Number(access.purchase_limit)>0&&total>Number(access.purchase_limit))return edit(env,chat,mid,`⛔ سقف خرید حساب شما <b>${Number(access.purchase_limit).toFixed(2)} Credit</b> است.`); const b=await balance(env,uid);
  let t=`🛒 <b>خلاصه سفارش</b>\n\n📦 محصول: <b>${esc(p.title)}</b>\n🔢 تعداد: <b>${qty}</b>\n💎 قیمت اولیه: <b>${subtotal.toFixed(2)} Credit</b>`;
  if(d)t+=`\n🏷 کد تخفیف: <b>${esc(d.code)}</b>\n➖ تخفیف: <b>${off.toFixed(2)} Credit</b>`; t+=`\n💰 مبلغ نهایی: <b>${total.toFixed(2)} Credit</b>\n\nموجودی فعلی: <b>${b.total.toFixed(2)} Credit</b>`;
  await edit(env,chat,mid,t,[[{text:'🏷 وارد کردن کد تخفیف',callback_data:`shop:discount:${pid}:${qty}`}],[{text:'✅ تأیید و پرداخت',callback_data:`shop:buy:${pid}:${qty}:${d?.id||0}`}],[{text:'⬅️ بازگشت',callback_data:`shop:p:${pid}`}]]);
}
async function buyProduct(env:Env,uid:number,chat:number,mid:number,pid:number,qty:number,discountId=0){
  if(!(await featureEnabled(env,'feature_shop',true)))return edit(env,chat,mid,'⛔ فروشگاه موقتاً غیرفعال است.',[[{text:'🏠 منوی اصلی',callback_data:'menu'}]]);
  const access=await getUserAccess(env,uid);if(Number(access.banned))return edit(env,chat,mid,'⛔ دسترسی حساب شما محدود شده است. برای پیگیری با پشتیبانی تماس بگیر.');
  if(!Number.isInteger(qty)||qty<1||qty>100)return edit(env,chat,mid,'❌ تعداد نامعتبر است.',[[{text:'⬅️ فروشگاه',callback_data:'shop:list'}]]);
  if(!(await stockKey(env)))return edit(env,chat,mid,'⚠️ فروشگاه موقتاً برای تحویل امن استوک تنظیم نشده است. لطفاً با پشتیبانی تماس بگیر.',[[{text:'⬅️ فروشگاه',callback_data:'shop:list'}]]);
  const p:any=await env.DB.prepare('SELECT * FROM products WHERE id=? AND enabled=1').bind(pid).first(); if(!p)return;
  const subtotal=Number(p.price_credits)*qty; const d=await validDiscount(env,discountId,subtotal); const off=discountAmount(d,subtotal); const total=subtotal-off;if(access.purchase_limit!==null&&access.purchase_limit!==undefined&&Number(access.purchase_limit)>0&&total>Number(access.purchase_limit))return edit(env,chat,mid,`⛔ سقف خرید حساب شما <b>${Number(access.purchase_limit).toFixed(2)} Credit</b> است.`);
  const oid=publicId('O'); const costTotal=Number(p.cost_credits||0)*qty; const guardBalance=`bal:${oid}`,guardStock=`stk:${oid}`,guardDiscount=`dsc:${oid}`;
  const statements:D1PreparedStatement[]=[
    env.DB.prepare("INSERT INTO orders(public_id,telegram_id,product_id,quantity,unit_price,total_price,status,discount_code,discount_amount,cost_total) VALUES(?,?,?,?,?,?,'processing',?,?,?)").bind(oid,uid,pid,qty,p.price_credits,total,d?.code||null,off,costTotal),
    env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT ?,?,'purchase','order',?,'خرید از فروشگاه' WHERE (SELECT COALESCE(SUM(amount),0) FROM credit_ledger WHERE telegram_id=?)+0.000000001>=?").bind(uid,-total,oid,uid,total),
    env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM credit_ledger WHERE kind='purchase' AND ref_type='order' AND ref_id=?) THEN 1 ELSE 0 END").bind(guardBalance,oid),
    env.DB.prepare("UPDATE product_stock SET status='delivered',order_id=(SELECT id FROM orders WHERE public_id=?),delivered_at=CURRENT_TIMESTAMP WHERE id IN (SELECT id FROM product_stock WHERE product_id=? AND status='available' ORDER BY id LIMIT ?) AND status='available'").bind(oid,pid,qty),
    env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN (SELECT COUNT(*) FROM product_stock WHERE order_id=(SELECT id FROM orders WHERE public_id=?))=? THEN 1 ELSE 0 END").bind(guardStock,oid,qty)
  ];
  if(d){
    statements.push(env.DB.prepare("INSERT INTO discount_redemptions(discount_id,order_public_id,telegram_id) SELECT id,?,? FROM discount_codes WHERE id=? AND enabled=1 AND (expires_at IS NULL OR datetime(expires_at)>datetime('now')) AND min_total<=? AND (max_uses IS NULL OR uses_count<max_uses)").bind(oid,uid,d.id,subtotal));
    statements.push(env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM discount_redemptions WHERE order_public_id=?) THEN 1 ELSE 0 END").bind(guardDiscount,oid));
    statements.push(env.DB.prepare("UPDATE discount_codes SET uses_count=uses_count+1 WHERE id=? AND EXISTS(SELECT 1 FROM discount_redemptions WHERE discount_id=? AND order_public_id=?)").bind(d.id,d.id,oid));
  }
  statements.push(env.DB.prepare("UPDATE orders SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE public_id=?").bind(oid));
  statements.push(env.DB.prepare("DELETE FROM security_guards WHERE tag IN (?,?,?)").bind(guardBalance,guardStock,guardDiscount));
  try{await env.DB.batch(statements);}catch(e){
    console.log('atomic purchase rejected',oid,String(e));
    const b=await balance(env,uid);const stock:any=await env.DB.prepare("SELECT COUNT(*) c FROM product_stock WHERE product_id=? AND status='available'").bind(pid).first();
    const msg=b.total+1e-9<total?`❌ موجودی کافی نیست.

نیاز: <b>${total.toFixed(2)}</b>
موجودی: <b>${b.total.toFixed(2)}</b>`:Number(stock?.c||0)<qty?'❌ موجودی محصول در همین لحظه تمام شد.':'❌ سفارش هم‌زمان تغییر کرد یا کد تخفیف دیگر معتبر نیست. دوباره تلاش کن.';
    return edit(env,chat,mid,msg,[[{text:'🔄 تلاش دوباره',callback_data:`shop:summary:${pid}:${qty}:0`}],[{text:'⬅️ فروشگاه',callback_data:'shop:list'}]]);
  }
  const order:any=await env.DB.prepare('SELECT id FROM orders WHERE public_id=?').bind(oid).first();
  const stocks:any=await env.DB.prepare('SELECT secret_value FROM product_stock WHERE order_id=? ORDER BY id').bind(order?.id).all();
  const deliveredLines:string[]=[];let deliveryError=false;
  for(let i=0;i<(stocks.results||[]).length;i++){try{deliveredLines.push(`${i+1}. <code>${esc(await decryptStock(env,String(stocks.results[i].secret_value)))}</code>`);}catch{deliveryError=true;deliveredLines.push(`${i+1}. <i>تحویل امن نیاز به بررسی پشتیبانی دارد</i>`);}}
  const delivered=deliveredLines.join('\n'); let payText=`💎 ${total.toFixed(2)} Credit`;if(off)payText+=` (تخفیف ${off.toFixed(2)})`;
  if(deliveryError)for(const a of admins(env))await send(env,a,`⚠️ خطای رمزگشایی استوک سفارش <code>${oid}</code>. کلید STOCK_ENCRYPTION_KEY را بررسی کن.`);
  await rewardReferral(env,uid,'first_purchase');
  await notifyAdmins(env,'order',`🛒 <b>سفارش جدید</b>\n\n🧾 <code>${oid}</code>\n👤 <code>${uid}</code>\n📦 ${esc(p.title)} × ${qty}\n💎 ${total.toFixed(2)} Credit`,oid);
  const remain:any=await env.DB.prepare("SELECT COUNT(*) c FROM product_stock WHERE product_id=? AND status='available'").bind(pid).first();const low=Number(await getSetting(env,'low_stock_threshold','5'))||5;if(Number(remain?.c||0)<=low)await notifyAdmins(env,'low_stock',`⚠️ <b>موجودی کم</b>\n\n📦 ${esc(p.title)}\nموجودی باقی‌مانده: <b>${Number(remain?.c||0)}</b>`,String(pid));
  await edit(env,chat,mid,`✅ <b>سفارش تکمیل شد</b>

🧾 ${oid}
🛍 ${esc(p.title)} × ${qty}
${payText}

📦 <b>تحویل:</b>
${delivered}`,[[{text:'🆘 مشکل با این سفارش',callback_data:`support:order:${order?.id}`}],[{text:'📜 تاریخچه',callback_data:'history:shop:0'}],[{text:'🏠 منوی اصلی',callback_data:'menu'}]]);
}

const faStatus=(s:string)=>({completed:'✅ تکمیل',paid:'✅ پرداخت‌شده',pending:'⏳ در انتظار',expired:'⌛ منقضی',cancelled:'❌ لغوشده',manual_review:'🔎 بررسی دستی',awaiting_receipt:'📷 منتظر رسید',rejected:'❌ ردشده',processing:'⚙️ پردازش',refunded:'↩️ Refund'}[s]||s);
async function showHistoryMenu(env:Env,chat:number,mid:number){
  await edit(env,chat,mid,'📜 <b>تاریخچه من</b>\n\nچه چیزی را می‌خواهی ببینی؟',[[{text:'🛍 تاریخچه فروشگاه',callback_data:'history:shop:0'}],[{text:'💳 تاریخچه پرداخت‌ها',callback_data:'history:pay:0'}],[{text:'⬅️ منوی اصلی',callback_data:'menu'}]]);
}
async function showShopHistory(env:Env,uid:number,chat:number,mid:number,page:number){
  const limit=5,off=page*limit;
  const q:any=await env.DB.prepare('SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.telegram_id=? ORDER BY o.id DESC LIMIT ? OFFSET ?').bind(uid,limit+1,off).all();
  const rows=q.results||[]; const more=rows.length>limit; const items=rows.slice(0,limit);
  let t=`🛍 <b>تاریخچه فروشگاه</b> — صفحه ${page+1}\n\n`;
  if(!items.length)t+='هنوز سفارشی نداری.';
  items.forEach((x:any,i:number)=>{t+=`${i+1}. <b>${esc(x.title)}</b> × ${x.quantity}\n🧾 <code>${x.public_id}</code> — ${faStatus(x.status)} — 💎 ${Number(x.total_price).toFixed(2)}\n\n`});
  const nav:Btn[]=[]; if(page>0)nav.push({text:'⬅️ قبلی',callback_data:`history:shop:${page-1}`}); if(more)nav.push({text:'بعدی ➡️',callback_data:`history:shop:${page+1}`});
  const kb:Btn[][]=[]; if(nav.length)kb.push(nav); kb.push([{text:'📜 تاریخچه',callback_data:'history:menu'}]);
  await edit(env,chat,mid,t,kb);
}
async function showPaymentHistory(env:Env,uid:number,chat:number,mid:number,page:number){
  const limit=6,off=page*limit;
  const q:any=await env.DB.prepare('SELECT * FROM payment_invoices WHERE telegram_id=? ORDER BY id DESC LIMIT ? OFFSET ?').bind(uid,limit+1,off).all();
  const rows=q.results||[]; const more=rows.length>limit; const items=rows.slice(0,limit);
  let t=`💳 <b>تاریخچه پرداخت‌ها</b> — صفحه ${page+1}\n\n`;
  if(!items.length)t+='هنوز پرداختی نداری.';
  items.forEach((x:any,i:number)=>{t+=`${i+1}. <code>${x.public_id}</code>\n${x.method==='card'?'🏦 کارت به کارت':`${x.network==='TRC20'?'🔴':x.network==='TON'?'💎':'🟡'} ${x.asset||'USDT'} ${x.network||''}`} — ${faStatus(x.status)}\n💵 $${Number(x.requested_usd).toFixed(2)} → 💎 ${Number(x.credit_amount).toFixed(2)}\n\n`});
  const nav:Btn[]=[]; if(page>0)nav.push({text:'⬅️ قبلی',callback_data:`history:pay:${page-1}`}); if(more)nav.push({text:'بعدی ➡️',callback_data:`history:pay:${page+1}`});
  const kb:Btn[][]=[]; if(nav.length)kb.push(nav); kb.push([{text:'📜 تاریخچه',callback_data:'history:menu'}]);
  await edit(env,chat,mid,t,kb);
}
async function showReferral(env:Env,uid:number,chat:number,mid:number){
  const st:any=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='rewarded' THEN 1 ELSE 0 END) rewarded,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,COALESCE(SUM(CASE WHEN status='rewarded' THEN reward ELSE 0 END),0) earned FROM referrals WHERE inviter_telegram_id=?").bind(uid).first();
  const rs=await referralSettings(env);const tier=referralTier(Number(st?.rewarded||0),rs);const access=await getUserAccess(env,uid);const link=`https://t.me/${env.BOT_USERNAME}?start=ref_${uid}`;
  const trigger=rs.trigger==='first_purchase'?'بعد از اولین خرید موفق':'بعد از عضویت معتبر';const disabledNote=Number(access.referral_disabled)?'\n\n⛔ سیستم Referral برای حساب شما غیرفعال است.':'';
  const t=`🎁 <b>دعوت و درآمد</b>\n\n${tier.emoji} سطح: <b>${tier.name}</b> — ضریب ${tier.mult}×\n🔗 لینک اختصاصی:\n<code>${link}</code>\n\n👥 کل دعوت‌ها: <b>${Number(st?.total||0)}</b>\n✅ پاداش‌گرفته: <b>${Number(st?.rewarded||0)}</b>\n⏳ در انتظار: <b>${Number(st?.pending||0)}</b>\n💰 درآمد: <b>${Number(st?.earned||0).toFixed(2)} Credit</b>\n\nپاداش پایه: <b>${rs.amount.toFixed(2)} Credit</b> (${trigger})${disabledNote}`;
  await edit(env,chat,mid,t,[[{text:'📋 کپی لینک دعوت',copy_text:{text:link}}],[{text:'⬅️ منوی اصلی',callback_data:'menu'}]]);
}

async function showSupportMenu(env:Env,chat:number,mid:number){
  await edit(env,chat,mid,'🆘 <b>پشتیبانی</b>\n\nموضوع مشکل را انتخاب کن:',[
    [{text:'💳 مشکل پرداخت',callback_data:'support:new:payment'}],
    [{text:'🛍 مشکل محصول / سفارش',callback_data:'support:orders'}],
    [{text:'❓ سایر موارد',callback_data:'support:new:other'}],
    [{text:'🎫 تیکت‌های من',callback_data:'support:mine'}],[{text:'⬅️ منوی اصلی',callback_data:'menu'}]
  ]);
}
async function showSupportOrders(env:Env,uid:number,chat:number,mid:number){
  const q:any=await env.DB.prepare('SELECT o.id,o.public_id,p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.telegram_id=? ORDER BY o.id DESC LIMIT 10').bind(uid).all();
  const rows:Btn[][]=(q.results||[]).map((x:any)=>[{text:`${x.public_id} — ${x.title}`.slice(0,60),callback_data:`support:order:${x.id}`}]);
  rows.push([{text:'⬅️ پشتیبانی',callback_data:'support:menu'}]);
  await edit(env,chat,mid,'🛍 <b>مشکل محصول / سفارش</b>\n\nسفارشی که با آن مشکل داری انتخاب کن:',rows);
}
async function beginTicket(env:Env,uid:number,chat:number,mid:number,category:string,orderId?:number){
  await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`await_ticket:${category}:${orderId||0}`,uid).run();
  await edit(env,chat,mid,'✍️ <b>شرح مشکل را ارسال کن</b>\n\nمی‌توانی متن، عکس یا فایل بفرستی. بعد از ارسال، تیکت ساخته می‌شود و ادمین پاسخ را داخل همین ربات می‌فرستد.',[[{text:'❌ انصراف',callback_data:'support:cancel'}]]);
}
async function createTicketFromMessage(env:Env,m:Message,state:string){
  if(!m.from)return;
  const [,category,orderRaw]=state.split(':'); const orderId=Number(orderRaw)||null;
  const pid=publicId('T');
  const r=await env.DB.prepare('INSERT INTO support_tickets(public_id,telegram_id,category,order_id,status,last_message) VALUES(?,?,?,?,\'open\',?)').bind(pid,m.from.id,category,orderId,m.text||m.caption||'[فایل]').run();
  const ticketId=Number(r.meta.last_row_id);
  const type=m.photo?.length?'photo':m.document?'document':'text';
  const fileId=m.photo?.length?m.photo[m.photo.length-1].file_id:m.document?.file_id||null;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO support_messages(ticket_id,sender_type,sender_telegram_id,message_type,text,file_id) VALUES(?,\'user\',?,?,?,?)').bind(ticketId,m.from.id,type,m.text||m.caption||null,fileId),
    env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(m.from.id)
  ]);
  const orderText=orderId?`\n🛍 Order ID: <code>${orderId}</code>`:'';
  const cap=`🎫 <b>تیکت جدید</b>\n\n🧾 <code>${pid}</code>\n👤 ${m.from.username?'@'+esc(m.from.username):esc(m.from.first_name||String(m.from.id))}\n🆔 <code>${m.from.id}</code>\n📂 ${esc(category)}${orderText}\n\n${esc(m.text||m.caption||'فایل پیوست شده')}`;
  const kb={inline_keyboard:[[{text:'💬 پاسخ',callback_data:`admin:ticket:reply:${ticketId}`},{text:'✅ بستن',callback_data:`admin:ticket:close:${ticketId}`}]]};
  for(const a of admins(env)){
    if(type==='photo')await tg(env,'sendPhoto',{chat_id:a,photo:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb});
    else if(type==='document')await tg(env,'sendDocument',{chat_id:a,document:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb});
    else await tg(env,'sendMessage',{chat_id:a,text:cap,parse_mode:'HTML',reply_markup:kb});
  }
  await send(env,m.chat.id,`✅ تیکت <code>${pid}</code> ساخته شد.\nپاسخ پشتیبانی از همین ربات برایت ارسال می‌شود.`,[[{text:'🎫 تیکت‌های من',callback_data:'support:mine'}],[{text:'🏠 منوی اصلی',callback_data:'menu'}]]);
}
async function showMyTickets(env:Env,uid:number,chat:number,mid:number){
  const q:any=await env.DB.prepare('SELECT * FROM support_tickets WHERE telegram_id=? ORDER BY id DESC LIMIT 10').bind(uid).all();
  let t='🎫 <b>تیکت‌های من</b>\n\n'; if(!(q.results||[]).length)t+='تیکتی نداری.';
  for(const x of q.results||[])t+=`• <code>${x.public_id}</code> — ${x.status==='open'?'🟢 باز':'⚪ بسته'}\n${esc((x.last_message||'').slice(0,90))}\n\n`;
  await edit(env,chat,mid,t,[[{text:'⬅️ پشتیبانی',callback_data:'support:menu'}]]);
}
async function forwardUserTicketMessage(env:Env,m:Message,ticket:any){
  const type=m.photo?.length?'photo':m.document?'document':'text'; const fileId=m.photo?.length?m.photo[m.photo.length-1].file_id:m.document?.file_id||null; const txt=m.text||m.caption||null;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO support_messages(ticket_id,sender_type,sender_telegram_id,message_type,text,file_id) VALUES(?,\'user\',?,?,?,?)').bind(ticket.id,m.from!.id,type,txt,fileId),
    env.DB.prepare('UPDATE support_tickets SET last_message=?,updated_at=CURRENT_TIMESTAMP,status=\'open\' WHERE id=?').bind(txt||'[فایل]',ticket.id)
  ]);
  const cap=`💬 <b>پیام جدید در تیکت</b> <code>${ticket.public_id}</code>\n\n${esc(txt||'فایل پیوست شده')}`;
  const kb={inline_keyboard:[[{text:'💬 پاسخ',callback_data:`admin:ticket:reply:${ticket.id}`},{text:'✅ بستن',callback_data:`admin:ticket:close:${ticket.id}`}]]};
  for(const a of admins(env)){
    if(type==='photo')await tg(env,'sendPhoto',{chat_id:a,photo:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb}); else if(type==='document')await tg(env,'sendDocument',{chat_id:a,document:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb}); else await tg(env,'sendMessage',{chat_id:a,text:cap,parse_mode:'HTML',reply_markup:kb});
  }
}

async function showAdmin(env:Env,chat:number,mid?:number){
  const users:any=await env.DB.prepare('SELECT COUNT(*) c FROM users').first();
  const cards:any=await env.DB.prepare("SELECT COUNT(*) c FROM payment_invoices WHERE method='card' AND status='manual_review'").first();
  const tickets:any=await env.DB.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status='open'").first();
  const products:any=await env.DB.prepare('SELECT COUNT(*) c FROM products WHERE enabled=1').first();
  const t=`🛠 <b>مرکز مدیریت</b>

👥 کاربران: <b>${Number(users?.c||0)}</b> | 🛍 محصولات: <b>${Number(products?.c||0)}</b>
🏦 بررسی پرداخت: <b>${Number(cards?.c||0)}</b> | 🎫 تیکت باز: <b>${Number(tickets?.c||0)}</b>

یک بخش را انتخاب کن:`;
  const rows:Btn[][]=[
    [{text:'🛍 فروش و محتوا',callback_data:'admin:section:commerce'},{text:'💳 مالی و پرداخت',callback_data:'admin:section:finance'}],
    [{text:'👥 کاربران و پشتیبانی',callback_data:'admin:section:users'},{text:'⚙️ سیستم و امنیت',callback_data:'admin:section:system'}],
    [{text:'📊 آمار کلی',callback_data:'admin:stats'}],
    [{text:'🏠 خروج از حالت مدیریت',callback_data:'menu'}]
  ];
  mid?await edit(env,chat,mid,t,rows):await send(env,chat,t,rows);
}
async function adminSection(env:Env,chat:number,mid:number,section:string){
  const back={text:'⬅️ مرکز مدیریت',callback_data:'admin:home'};let t='';let rows:Btn[][]=[];
  if(section==='commerce'){t=`🛍 <b>فروش و محتوا</b>

مدیریت کاتالوگ، موجودی و فروش.`;rows=[[{text:'🛍 محصولات',callback_data:'admin:products'},{text:'📦 استوک',callback_data:'admin:stock'}],[{text:'🗂 دسته‌بندی‌ها',callback_data:'admin:categories'},{text:'🏷 کدهای تخفیف',callback_data:'admin:discounts'}],[{text:'🧾 سفارش‌ها / Refund',callback_data:'admin:orders'}],[back]];}
  else if(section==='finance'){t=`💳 <b>مالی و پرداخت</b>

شبکه‌ها، نرخ‌ها و بررسی پرداخت.`;rows=[[{text:'💳 تنظیمات پرداخت',callback_data:'admin:payments'},{text:'📈 نرخ‌ها',callback_data:'admin:rates'}],[{text:'🔄 اسکن کریپتو',callback_data:'admin:scan'},{text:'🧪 تست پرداخت‌ها',callback_data:'admin:paytest:all'}],[back]];}
  else if(section==='users'){t=`👥 <b>کاربران و پشتیبانی</b>

مدیریت ارتباط با کاربران و Referral.`;rows=[[{text:'🎫 تیکت‌ها',callback_data:'admin:tickets'},{text:'🛡 ریسک و Ban',callback_data:'admin:risk'}],[{text:'🎁 تنظیمات Referral',callback_data:'admin:referral:settings'},{text:'📣 Broadcast',callback_data:'admin:broadcast'}],[{text:'📢 جوین اجباری',callback_data:'admin:channels'}],[back]];}
  else {t=`⚙️ <b>سیستم و امنیت</b>

کنترل قابلیت‌ها و وضعیت عملیاتی.`;rows=[[{text:'⚙️ قابلیت‌ها',callback_data:'admin:features'},{text:'🧰 نگهداری',callback_data:'admin:maintenance'}],[{text:'🚫 Blacklist',callback_data:'admin:blacklist'},{text:'📊 آمار',callback_data:'admin:stats'}],[back]];}
  return edit(env,chat,mid,t,rows);
}
async function adminProducts(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare("SELECT p.*,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p ORDER BY id DESC LIMIT 20").all();
  const rows:Btn[][]=(q.results||[]).map((p:any)=>[{text:`${p.enabled?'🟢':'⚪'} ${p.title} (${p.stock})`.slice(0,58),callback_data:`admin:product:${p.id}`}]);
  rows.push([{text:'➕ محصول جدید',callback_data:'admin:product:new'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'🛍 <b>مدیریت محصولات</b>\n\nبرای ویرایش هر محصول روی آن بزن.',rows);
}
async function adminProductDetail(env:Env,chat:number,mid:number,pid:number){
  const p:any=await env.DB.prepare("SELECT p.*,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p WHERE id=?").bind(pid).first(); if(!p)return;
  const t=`🛍 <b>${esc(p.title)}</b>\n\nID: <code>${p.id}</code>\n💎 قیمت: ${Number(p.price_credits).toFixed(2)} cr\n📦 استوک: ${p.stock}\nوضعیت: ${p.enabled?'🟢 فعال':'⚪ غیرفعال'}\n\n${esc(p.description||'')}`;
  await edit(env,chat,mid,t,[[{text:p.enabled?'⏸ غیرفعال':'▶️ فعال',callback_data:`admin:product:toggle:${p.id}`}],[{text:'📦 افزودن استوک',callback_data:`admin:stock:add:${p.id}`}],[{text:'💎 تغییر قیمت',callback_data:`admin:product:price:${p.id}`},{text:'🗂 تغییر دسته',callback_data:`admin:product:category:${p.id}`}],[{text:'⬅️ محصولات',callback_data:'admin:products'}]]);
}
async function adminStock(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare("SELECT p.id,p.title,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p ORDER BY id DESC LIMIT 20").all();
  const rows:Btn[][]=(q.results||[]).map((p:any)=>[{text:`📦 ${p.title} — ${p.stock}`,callback_data:`admin:stock:add:${p.id}`}]); rows.push([{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'📦 <b>مدیریت استوک</b>\n\nمحصول را انتخاب کن و استوک‌ها را خط‌به‌خط بفرست.',rows);
}
async function adminTickets(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare("SELECT * FROM support_tickets WHERE status='open' ORDER BY id DESC LIMIT 20").all();
  const rows:Btn[][]=(q.results||[]).map((t:any)=>[{text:`🎫 ${t.public_id} — ${t.category}`,callback_data:`admin:ticket:view:${t.id}`}]); rows.push([{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'🎫 <b>تیکت‌های باز</b>',rows);
}
async function adminTicketView(env:Env,chat:number,mid:number,id:number){
  const t:any=await env.DB.prepare('SELECT * FROM support_tickets WHERE id=?').bind(id).first(); if(!t)return;
  const ms:any=await env.DB.prepare('SELECT * FROM support_messages WHERE ticket_id=? ORDER BY id DESC LIMIT 6').bind(id).all();
  let text=`🎫 <b>${t.public_id}</b>\n👤 <code>${t.telegram_id}</code>\n📂 ${esc(t.category)}\nوضعیت: ${t.status}\n\n`;
  for(const m of (ms.results||[]).reverse())text+=`${m.sender_type==='admin'?'👨‍💻':'👤'} ${esc(m.text||'[فایل]')}\n`;
  await edit(env,chat,mid,text,[[{text:'💬 پاسخ',callback_data:`admin:ticket:reply:${id}`}],[{text:'✅ بستن',callback_data:`admin:ticket:close:${id}`}],[{text:'⬅️ تیکت‌ها',callback_data:'admin:tickets'}]]);
}
async function adminStats(env:Env,chat:number,mid:number){
  const u:any=await env.DB.prepare('SELECT COUNT(*) users FROM users').first();
  const sales:any=await env.DB.prepare("SELECT COUNT(*) orders,COALESCE(SUM(total_price),0) revenue FROM orders WHERE status='completed'").first();
  const topups:any=await env.DB.prepare("SELECT COALESCE(SUM(credit_amount),0) credits FROM payment_invoices WHERE status='paid'").first();
  const refs:any=await env.DB.prepare("SELECT COUNT(*) c FROM referrals WHERE status='rewarded'").first();
  await edit(env,chat,mid,`📊 <b>آمار کلی</b>\n\n👥 کاربران: <b>${Number(u?.users||0)}</b>\n🛍 سفارش تکمیل‌شده: <b>${Number(sales?.orders||0)}</b>\n💎 فروش فروشگاه: <b>${Number(sales?.revenue||0).toFixed(2)} Credit</b>\n💳 شارژ تأییدشده: <b>${Number(topups?.credits||0).toFixed(2)} Credit</b>\n🎁 Referral موفق: <b>${Number(refs?.c||0)}</b>`,[[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]]);
}

async function adminCategories(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare('SELECT c.*,(SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) products FROM shop_categories c ORDER BY sort_order,id').all();
  const rows:Btn[][]=(q.results||[]).map((c:any)=>[{text:`${c.enabled?'🟢':'⚪'} ${c.emoji||'🛍'} ${c.title} (${c.products})`,callback_data:`admin:category:toggle:${c.id}`}]);
  rows.push([{text:'➕ دسته جدید',callback_data:'admin:category:new'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'🗂 <b>دسته‌بندی‌های فروشگاه</b>\n\nبا لمس هر دسته فعال/غیرفعال می‌شود.',rows);
}
async function adminProductCategory(env:Env,chat:number,mid:number,pid:number){
  const q:any=await env.DB.prepare('SELECT * FROM shop_categories ORDER BY sort_order,id').all();
  const rows:Btn[][]=(q.results||[]).map((c:any)=>[{text:`${c.emoji||'🛍'} ${c.title}`,callback_data:`admin:product:setcat:${pid}:${c.id}`}]); rows.push([{text:'⬅️ محصول',callback_data:`admin:product:${pid}`}]);
  await edit(env,chat,mid,'🗂 دسته‌بندی جدید محصول را انتخاب کن:',rows);
}
async function adminChannels(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare('SELECT * FROM required_channels ORDER BY sort_order,id').all();
  const rows:Btn[][]=(q.results||[]).map((c:any)=>[{text:`${c.enabled?'🟢':'⚪'} ${c.title}`,callback_data:`admin:channel:toggle:${c.id}`},{text:'🗑',callback_data:`admin:channel:delete:${c.id}`}]);
  rows.push([{text:'➕ افزودن کانال',callback_data:'admin:channel:new'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'📢 <b>جوین اجباری</b>\n\nبات باید در کانال/گروه موردنظر Admin باشد. با لمس نام، وضعیت فعال/غیرفعال می‌شود.',rows);
}
async function adminDiscounts(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare('SELECT * FROM discount_codes ORDER BY id DESC LIMIT 30').all();
  const rows:Btn[][]=(q.results||[]).map((d:any)=>[{text:`${d.enabled?'🟢':'⚪'} ${d.code} — ${d.discount_type==='percent'?d.value+'%':d.value+' cr'} (${d.uses_count}${d.max_uses!==null?'/'+d.max_uses:''})`,callback_data:`admin:discount:toggle:${d.id}`}]);
  rows.push([{text:'➕ کد جدید',callback_data:'admin:discount:new'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'🏷 <b>کدهای تخفیف</b>\n\nبا لمس هر کد فعال/غیرفعال می‌شود.',rows);
}
async function adminPayments(env:Env,chat:number,mid:number){
  const c=await paymentConfig(env); const short=(x:string)=>x?`${x.slice(0,8)}…${x.slice(-6)}`:'تنظیم نشده';
  const mode=(await getSetting(env,'ton_rate_mode','auto')).toLowerCase(); const updated=await getSetting(env,'ton_usd_rate_updated_at','');const source=await getSetting(env,'ton_usd_rate_source','');const b=await bep20Status(env);
  const bepState=!b.enabled?'⚪ غیرفعال':!b.ready?'🔴 تنظیم ناقص':b.testMode?'🧪 تست':'🟢 واقعی';
  const t=`💳 <b>تنظیمات پرداخت</b>

<b>شبکه‌ها</b>
🟡 BEP20: <code>${esc(short(c.bep20))}</code> — <b>${bepState}</b>
🔴 TRC20: <code>${esc(short(c.trc20))}</code>
💎 TON: <code>${esc(short(c.ton))}</code>

<b>نرخ</b>
📈 TON/USD: <b>${c.tonRate||'تنظیم نشده'}</b>${source?` — ${esc(source)}`:''}
🤖 حالت: <b>${mode==='auto'?'خودکار':'دستی'}</b>${updated?`
🕒 بروزرسانی: ${esc(updated)}`:''}

<b>کارت</b>
🏦 <code>${esc(c.card||'تنظیم نشده')}</code>
👤 <b>${esc(c.cardHolder||'—')}</b>`;
  await edit(env,chat,mid,t,[
    [{text:'🧪 تست همه روش‌ها',callback_data:'admin:paytest:all'}],
    [{text:'🟡 BEP20',callback_data:'admin:paytest:bep20'},{text:'🔴 TRC20',callback_data:'admin:paytest:trc20'},{text:'💎 TON',callback_data:'admin:paytest:ton'}],
    [{text:'🏦 کارت',callback_data:'admin:paytest:card'},{text:'📈 Rate Engine',callback_data:'admin:paytest:rates'}],
    [{text:'🟡 آدرس BEP20',callback_data:'admin:payset:wallet_bep20'},{text:'🔴 آدرس TRC20',callback_data:'admin:payset:wallet_trc20'}],
    [{text:'💎 آدرس TON',callback_data:'admin:payset:wallet_ton'},{text:'🏦 شماره کارت',callback_data:'admin:payset:card_number'}],
    [{text:b.testMode?'🧪 BEP20: TEST':'🟢 BEP20: LIVE',callback_data:'admin:bep20:mode'},{text:b.enabled?'⏸ خاموش BEP20':'▶️ روشن BEP20',callback_data:'admin:bep20:toggle'}],
    ...(b.testMode?[[{text:'💸 ساخت فاکتور تست واقعی BEP20',callback_data:'admin:bep20:testinvoice'}]]:[]),
    [{text:mode==='auto'?'✅ نرخ خودکار':'🤖 نرخ خودکار',callback_data:'admin:tonrate:auto'},{text:'🔄 بروزرسانی نرخ',callback_data:'admin:tonrate:refresh'}],
    [{text:'✍️ نرخ دستی TON',callback_data:'admin:payset:ton_usd_rate'},{text:'👤 صاحب کارت',callback_data:'admin:payset:card_holder'}],
    [{text:'⬅️ مالی و پرداخت',callback_data:'admin:section:finance'}]
  ]);
}
async function adminOrders(env:Env,chat:number,mid:number){
  const q:any=await env.DB.prepare("SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id ORDER BY o.id DESC LIMIT 20").all();
  const rows:Btn[][]=(q.results||[]).map((o:any)=>[{text:`${o.refunded_at?'↩️':'🧾'} ${o.public_id} — ${o.title} — ${Number(o.total_price).toFixed(2)}cr`.slice(0,62),callback_data:`admin:order:${o.id}`}]); rows.push([{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,'🧾 <b>سفارش‌های اخیر</b>\n\nبرای جزئیات و Refund روی سفارش بزن.',rows);
}
async function adminOrderDetail(env:Env,chat:number,mid:number,id:number){
  const o:any=await env.DB.prepare('SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id WHERE o.id=?').bind(id).first(); if(!o)return;
  const t=`🧾 <b>${o.public_id}</b>\n\n👤 <code>${o.telegram_id}</code>\n🛍 ${esc(o.title)} × ${o.quantity}\n💎 مبلغ نهایی: <b>${Number(o.total_price).toFixed(2)} Credit</b>\n🏷 تخفیف: <b>${Number(o.discount_amount||0).toFixed(2)}</b>${o.discount_code?` (${esc(o.discount_code)})`:''}\nوضعیت: ${faStatus(o.status)}\n↩️ Refund: ${o.refunded_at?'✅ انجام شده':'❌ انجام نشده'}`;
  const rows:Btn[][]=[]; if(!o.refunded_at&&o.status==='completed')rows.push([{text:'↩️ Refund کامل به Credit',callback_data:`admin:order:refund:${o.id}`}]); rows.push([{text:'⬅️ سفارش‌ها',callback_data:'admin:orders'}]); await edit(env,chat,mid,t,rows);
}
async function refundOrder(env:Env,adminId:number,id:number){
  const o:any=await env.DB.prepare("SELECT * FROM orders WHERE id=? AND status='completed' AND refunded_at IS NULL").bind(id).first(); if(!o)return null;
  const amount=Number(o.total_price),guard=`ref:${o.public_id}`;
  try{await env.DB.batch([
    env.DB.prepare("UPDATE orders SET status='refunded',refunded_at=CURRENT_TIMESTAMP,refund_amount=? WHERE id=? AND status='completed' AND refunded_at IS NULL").bind(amount,id),
    env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT ?,?,'refund','order',?,'Refund سفارش' WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND refunded_at IS NOT NULL)").bind(o.telegram_id,amount,o.public_id,id),
    env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM credit_ledger WHERE kind='refund' AND ref_type='order' AND ref_id=?) THEN 1 ELSE 0 END").bind(guard,o.public_id),
    env.DB.prepare('DELETE FROM security_guards WHERE tag=?').bind(guard)
  ]);}catch{return null;}
  await logAdmin(env,adminId,'order_refund','order',o.public_id,`amount=${amount}`);
  await send(env,o.telegram_id,`↩️ <b>Refund انجام شد</b>

🧾 ${o.public_id}
💎 ${amount.toFixed(2)} Credit به موجودی شما برگشت داده شد.`,[[{text:'💰 موجودی',callback_data:'balance'}]]); return o;
}

async function processBroadcasts(env:Env){
  if(!(await featureEnabled(env,'feature_broadcast',true)))return;
  const b:any=await env.DB.prepare("SELECT * FROM broadcasts WHERE status IN ('queued','running') ORDER BY id LIMIT 1").first(); if(!b)return;
  if(b.status==='queued')await env.DB.prepare("UPDATE broadcasts SET status='running',started_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.id).run();
  const users:any=await env.DB.prepare('SELECT id,telegram_id FROM users WHERE id>? ORDER BY id LIMIT 20').bind(b.last_user_id||0).all();
  const arr=users.results||[];
  if(!arr.length){await env.DB.prepare("UPDATE broadcasts SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.id).run();return;}
  let sent=0,failed=0,last=b.last_user_id||0;
  for(const u of arr){last=u.id; const r=await send(env,u.telegram_id,b.text); if(r.ok)sent++; else failed++;}
  await env.DB.prepare('UPDATE broadcasts SET last_user_id=?,sent_count=sent_count+?,failed_count=failed_count+? WHERE id=?').bind(last,sent,failed,b.id).run();
}


async function adminFeatures(env:Env,chat:number,mid:number){
  const keys=[['feature_shop','🛍 فروشگاه'],['feature_crypto','🪙 کریپتو'],['feature_card','🏦 کارت'],['feature_referral','🎁 Referral'],['feature_support','🆘 پشتیبانی'],['feature_broadcast','📣 Broadcast']];const rows:Btn[][]=[];
  for(const [k,l] of keys)rows.push([{text:`${await featureEnabled(env,k,true)?'🟢':'⚪'} ${l}`,callback_data:`admin:feature:${k}`}]);rows.push([{text:'🎁 تنظیم Referral',callback_data:'admin:referral:settings'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]);
  await edit(env,chat,mid,`⚙️ <b>قابلیت‌ها</b>\n\nبا لمس هر مورد فعال/غیرفعال می‌شود.`,rows);
}
async function adminReferralSettings(env:Env,chat:number,mid:number){const rs=await referralSettings(env);await edit(env,chat,mid,`🎁 <b>تنظیم Referral</b>\n\nTrigger: <b>${rs.trigger==='first_purchase'?'اولین خرید':'عضویت معتبر'}</b>\nپاداش پایه: <b>${rs.amount.toFixed(2)} Credit</b>\nSilver: ${rs.silver} دعوت ×${rs.sm}\nGold: ${rs.gold} دعوت ×${rs.gm}`,[[{text:'🔁 تغییر Trigger',callback_data:'admin:referral:trigger'}],[{text:'✍️ تغییر پاداش پایه',callback_data:'admin:referral:amount'}],[{text:'⬅️ قابلیت‌ها',callback_data:'admin:features'}]]);}
async function adminMaintenance(env:Env,chat:number,mid:number){const on=await maintenanceOn(env);await edit(env,chat,mid,`🧰 <b>حالت نگهداری</b>\n\nوضعیت: ${on?'🔴 فعال':'🟢 غیرفعال'}\n\nدر حالت نگهداری فقط ادمین‌ها می‌توانند از ربات استفاده کنند.`,[[{text:on?'🟢 خاموش کردن':'🔴 فعال کردن',callback_data:'admin:maintenance:toggle'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]]);}
async function adminRates(env:Env,chat:number,mid:number){await refreshRates(env);const ton=await getRate(env,'TONUSD'),tr=await getRate(env,'USDTRY'),ir=await getRate(env,'USDIRR');await edit(env,chat,mid,`📈 <b>Rate Engine</b>\n\nTON/USD: <b>${ton?ton.toFixed(4):'—'}</b>\nUSD/TRY: <b>${tr?tr.toFixed(4):'—'}</b>\nUSD/IRR: <b>${ir?ir.toFixed(0):'—'}</b>\n\nTON و USD/TRY می‌توانند خودکار باشند؛ USD/IRR به‌صورت دستی نگهداری می‌شود.`,[[{text:'🔄 بروزرسانی خودکار',callback_data:'admin:rates:refresh'}],[{text:'✍️ USD/TRY دستی',callback_data:'admin:rate:set:USDTRY'},{text:'✍️ USD/IRR دستی',callback_data:'admin:rate:set:USDIRR'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]]);}
async function adminRisk(env:Env,chat:number,mid:number){await edit(env,chat,mid,`🛡 <b>ریسک و محدودیت کاربران</b>\n\nTelegram ID کاربر را بفرست تا پروفایل مدیریتی باز شود.`,[[{text:'🔎 جستجو با ID',callback_data:'admin:risk:lookup'}],[{text:'🚫 Blacklist',callback_data:'admin:blacklist'}],[{text:'⬅️ پنل مدیریت',callback_data:'admin:home'}]]);}
async function adminBlacklist(env:Env,chat:number,mid:number){const q:any=await env.DB.prepare('SELECT * FROM risk_blacklist ORDER BY id DESC LIMIT 15').all();let t='🚫 <b>Blacklist</b>\n\n';for(const x of q.results||[])t+=`• ${esc(x.kind)}: <code>${esc(String(x.value).slice(0,70))}</code>\n`;await edit(env,chat,mid,t||'خالی',[[{text:'➕ Username',callback_data:'admin:blacklist:add:username'},{text:'➕ Wallet',callback_data:'admin:blacklist:add:wallet'}],[{text:'➕ TXID',callback_data:'admin:blacklist:add:txid'},{text:'🗑 حذف',callback_data:'admin:blacklist:remove'}],[{text:'⬅️ ریسک',callback_data:'admin:risk'}]]);}
async function adminRiskUser(env:Env,chat:number,mid:number,target:number){const u:any=await env.DB.prepare('SELECT * FROM users WHERE telegram_id=?').bind(target).first();if(!u)return edit(env,chat,mid,'کاربر پیدا نشد.',[[{text:'⬅️ ریسک',callback_data:'admin:risk'}]]);await edit(env,chat,mid,`🛡 <b>کاربر</b> <code>${target}</code>\n${u.username?'@'+esc(u.username):''}\n\nBan: ${u.banned?'🔴 بله':'🟢 خیر'}\nRisk: <b>${esc(u.risk_level||'normal')}</b>\nReferral: ${u.referral_disabled?'⛔ غیرفعال':'✅ فعال'}\nسقف خرید: <b>${u.purchase_limit??'نامحدود'}</b>`,[[{text:u.banned?'✅ Unban':'⛔ Ban',callback_data:`admin:risk:ban:${target}`}],[{text:'⚠️ تغییر Risk',callback_data:`admin:risk:level:${target}`}],[{text:u.referral_disabled?'✅ Referral On':'⛔ Referral Off',callback_data:`admin:risk:ref:${target}`}],[{text:'💳 سقف خرید',callback_data:`admin:risk:limit:${target}`},{text:'📝 یادداشت',callback_data:`admin:risk:note:${target}`}],[{text:'⬅️ ریسک',callback_data:'admin:risk'}]]);}

async function handleAdminState(env:Env,m:Message,state:string){
  if(!m.from||!isAdmin(env,m.from.id))return false;
  const uid=m.from.id; const text=(m.text||m.caption||'').trim();
  if(state==='admin_broadcast'){
    if(!text)return true;
    const id=publicId('B'); await env.DB.batch([
      env.DB.prepare("INSERT INTO broadcasts(public_id,admin_telegram_id,text,status) VALUES(?,?,?,'queued')").bind(id,uid,text),
      env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)
    ]); await logAdmin(env,uid,'broadcast_create','broadcast',id,text.slice(0,200)); await send(env,m.chat.id,`✅ Broadcast <code>${id}</code> وارد صف شد.\nهر دقیقه برای گروهی از کاربران ارسال می‌شود.`,[[{text:'🛠 پنل مدیریت',callback_data:'admin:home'}]]); return true;
  }
  if(state.startsWith('admin_stock:')){
    const pid=Number(state.split(':')[1]); const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length){await send(env,m.chat.id,'هر استوک را در یک خط بفرست.');return true;}
    if(!(await stockKey(env))){await send(env,m.chat.id,'❌ برای ذخیره امن استوک ابتدا Secret با نام <code>STOCK_ENCRYPTION_KEY</code> را در Cloudflare تنظیم کن.');return true;}
    const stmts:D1PreparedStatement[]=[];for(const x of lines)stmts.push(env.DB.prepare('INSERT INTO product_stock(product_id,secret_value) VALUES(?,?)').bind(pid,await encryptStock(env,x)));
    await env.DB.batch(stmts); await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); await logAdmin(env,uid,'stock_add','product',String(pid),`count=${lines.length};encrypted=1`); await send(env,m.chat.id,`✅ ${lines.length} استوک به‌صورت رمزنگاری‌شده اضافه شد.`,[[{text:'🛍 مشاهده محصول',callback_data:`admin:product:${pid}`}],[{text:'🛠 پنل مدیریت',callback_data:'admin:home'}]]); return true;
  }
  if(state.startsWith('admin_price:')){
    const pid=Number(state.split(':')[1]); const price=Number(text); if(!Number.isFinite(price)||price<0){await send(env,m.chat.id,'قیمت معتبر بفرست. مثال: <code>0.70</code>');return true;}
    await env.DB.batch([env.DB.prepare('UPDATE products SET price_credits=? WHERE id=?').bind(price,pid),env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)]); await logAdmin(env,uid,'product_price','product',String(pid),String(price)); await send(env,m.chat.id,'✅ قیمت تغییر کرد.',[[{text:'🛍 محصول',callback_data:`admin:product:${pid}`}]]); return true;
  }
  if(state.startsWith('admin_ticket_reply:')){
    const tid=Number(state.split(':')[1]); const ticket:any=await env.DB.prepare('SELECT * FROM support_tickets WHERE id=?').bind(tid).first(); if(!ticket){return true;}
    const type=m.photo?.length?'photo':m.document?'document':'text'; const fileId=m.photo?.length?m.photo[m.photo.length-1].file_id:m.document?.file_id||null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO support_messages(ticket_id,sender_type,sender_telegram_id,message_type,text,file_id) VALUES(?,'admin',?,?,?,?)").bind(tid,uid,type,text||null,fileId),
      env.DB.prepare("UPDATE support_tickets SET last_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(text||'[فایل]',tid),
      env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)
    ]);
    const cap=`💬 <b>پاسخ پشتیبانی</b>\n🎫 <code>${ticket.public_id}</code>\n\n${esc(text||'فایل پیوست شده')}\n\nبرای ادامه گفتگو، همین پیام را با دکمه زیر ادامه بده.`;
    const kb={inline_keyboard:[[{text:'↩️ ادامه گفتگو',callback_data:`support:continue:${tid}`}],[{text:'🏠 منوی اصلی',callback_data:'menu'}]]};
    if(type==='photo')await tg(env,'sendPhoto',{chat_id:ticket.telegram_id,photo:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb}); else if(type==='document')await tg(env,'sendDocument',{chat_id:ticket.telegram_id,document:fileId,caption:cap,parse_mode:'HTML',reply_markup:kb}); else await tg(env,'sendMessage',{chat_id:ticket.telegram_id,text:cap,parse_mode:'HTML',reply_markup:kb});
    await logAdmin(env,uid,'ticket_reply','ticket',ticket.public_id,text.slice(0,200)); await send(env,m.chat.id,'✅ پاسخ ارسال شد.',[[{text:'🎫 مشاهده تیکت',callback_data:`admin:ticket:view:${tid}`}]]); return true;
  }
  if(state==='admin_product_new_title'){
    if(!text)return true; await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_product_new_price:${encodeURIComponent(text)}`,uid).run(); await send(env,m.chat.id,'💎 قیمت محصول به Credit را بفرست. مثال: <code>0.70</code>'); return true;
  }
  if(state.startsWith('admin_product_new_price:')){
    const title=decodeURIComponent(state.slice('admin_product_new_price:'.length)); const price=Number(text); if(!Number.isFinite(price)||price<0){await send(env,m.chat.id,'قیمت معتبر بفرست.');return true;}
    await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_product_new_desc:${encodeURIComponent(title)}:${price}`,uid).run(); await send(env,m.chat.id,'📝 توضیح محصول را بفرست.'); return true;
  }
  if(state.startsWith('admin_product_new_desc:')){
    const raw=state.slice('admin_product_new_desc:'.length); const idx=raw.lastIndexOf(':'); const title=decodeURIComponent(raw.slice(0,idx)); const price=Number(raw.slice(idx+1));
    const r=await env.DB.prepare("INSERT INTO products(title,description,price_credits,delivery_type,enabled,sort_order,category_id) VALUES(?,?,?,'stock',1,100,1)").bind(title,text,price).run(); const pid=r.meta.last_row_id; await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); await logAdmin(env,uid,'product_create','product',String(pid),title); await send(env,m.chat.id,`✅ محصول ساخته شد. ID: <code>${pid}</code>`,[[{text:'📦 افزودن استوک',callback_data:`admin:stock:add:${pid}`}],[{text:'🛍 مشاهده محصول',callback_data:`admin:product:${pid}`}]]); return true;
  }
  if(state.startsWith('admin_setting:')){
    const key=state.split(':')[1]; const allowed=new Set(['wallet_bep20','wallet_trc20','wallet_ton','ton_usd_rate','card_number','card_holder']); if(!allowed.has(key)){await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();return true;}
    if(!text){await send(env,m.chat.id,'مقدار نمی‌تواند خالی باشد. برای غیرفعال‌کردن عبارت <code>OFF</code> را بفرست.');return true;}
    let value=text.trim();if(value.toUpperCase()==='OFF')value='';
    if(value){
      if(key==='wallet_bep20'&&!/^0x[a-fA-F0-9]{40}$/.test(value)){await send(env,m.chat.id,'❌ آدرس BEP20 معتبر نیست.');return true;}
      if(key==='wallet_trc20'&&!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)){await send(env,m.chat.id,'❌ آدرس TRON معتبر نیست.');return true;}
      if(key==='wallet_ton'&&!/^(?:[A-Za-z0-9_-]{40,80}|-?\d:[A-Fa-f0-9]{64})$/.test(value)){await send(env,m.chat.id,'❌ آدرس TON معتبر نیست.');return true;}
      if(key==='ton_usd_rate'){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>1e6){await send(env,m.chat.id,'❌ نرخ TON معتبر نیست.');return true;}value=String(n);}
      if(key==='card_number'){const digits=value.replace(/[^0-9]/g,'');if(digits.length<12||digits.length>24){await send(env,m.chat.id,'❌ شماره کارت/حساب معتبر نیست.');return true;}value=digits;}
      if(key==='card_holder'&&(value.length<2||value.length>120)){await send(env,m.chat.id,'❌ نام صاحب حساب معتبر نیست.');return true;}
    }
    await setSetting(env,key,value); await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); await logAdmin(env,uid,'payment_setting','setting',key,'updated'); await send(env,m.chat.id,'✅ تنظیم ذخیره شد.',[[{text:'💳 تنظیمات پرداخت',callback_data:'admin:payments'}]]); return true;
  }
  if(state==='admin_category_new'){
    const parts=text.split(/\s+/); let emoji='🛍',title=text;if(parts.length>1&&/[^\w\u0600-\u06FF]/u.test(parts[0])){emoji=parts.shift()!;title=parts.join(' ');} if(!title){await send(env,m.chat.id,'نام دسته را بفرست.');return true;}
    const r=await env.DB.prepare('INSERT INTO shop_categories(title,emoji,enabled,sort_order) VALUES(?,?,1,100)').bind(title,emoji).run();await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();await logAdmin(env,uid,'category_create','category',String(r.meta.last_row_id),title);await send(env,m.chat.id,'✅ دسته ساخته شد.',[[{text:'🗂 دسته‌بندی‌ها',callback_data:'admin:categories'}]]);return true;
  }
  if(state==='admin_channel_new_chat'){
    const chatId=text.trim();if(!/^(?:-?\d{5,20}|@[A-Za-z0-9_]{5,32})$/.test(chatId)){await send(env,m.chat.id,'❌ Chat ID معتبر نیست. مثال: <code>-1001234567890</code>');return true;}
    await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_channel_new_title:${encodeURIComponent(chatId)}`,uid).run();await send(env,m.chat.id,'📝 عنوان نمایشی کانال را بفرست.');return true;
  }
  if(state.startsWith('admin_channel_new_title:')){
    const chatId=decodeURIComponent(state.slice('admin_channel_new_title:'.length));const title=text.trim();if(!title||title.length>120){await send(env,m.chat.id,'❌ عنوان باید بین ۱ تا ۱۲۰ کاراکتر باشد.');return true;}await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_channel_new_url:${encodeURIComponent(chatId)}:${encodeURIComponent(title)}`,uid).run();await send(env,m.chat.id,'🔗 لینک Join را بفرست. مثال: <code>https://t.me/YourChannel</code>');return true;
  }
  if(state.startsWith('admin_channel_new_url:')){
    const raw=state.slice('admin_channel_new_url:'.length);const i=raw.indexOf(':');const chatId=decodeURIComponent(raw.slice(0,i));const title=decodeURIComponent(raw.slice(i+1));let join:URL;try{join=new URL(text.trim());}catch{await send(env,m.chat.id,'❌ لینک معتبر نیست.');return true;}if(join.protocol!=='https:'||!['t.me','telegram.me'].includes(join.hostname.toLowerCase())){await send(env,m.chat.id,'❌ لینک Join باید HTTPS و متعلق به t.me باشد.');return true;}
    await env.DB.prepare('INSERT OR REPLACE INTO required_channels(chat_id,title,join_url,enabled,sort_order) VALUES(?,?,?,1,100)').bind(chatId,title,join.toString()).run();await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();await logAdmin(env,uid,'channel_save','channel',chatId,title);await send(env,m.chat.id,'✅ کانال جوین اجباری ذخیره شد.',[[{text:'📢 کانال‌ها',callback_data:'admin:channels'}]]);return true;
  }
  if(state==='admin_discount_new'){
    const p=text.split(/\s+/);if(p.length<3){await send(env,m.chat.id,'فرمت صحیح:\n<code>CODE percent 10 0 100</code>\nیا\n<code>CODE fixed 2 5 50</code>\n\nبه‌ترتیب: کد، نوع، مقدار، حداقل خرید (اختیاری)، سقف استفاده (اختیاری)');return true;}
    const code=p[0].toUpperCase(),type=p[1].toLowerCase(),value=Number(p[2]),min=Number(p[3]||0),max=p[4]?Number(p[4]):null;if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!['percent','fixed'].includes(type)||!Number.isFinite(value)||value<=0||(type==='percent'&&value>100)||!Number.isFinite(min)||min<0||(max!==null&&(!Number.isInteger(max)||max<1))){await send(env,m.chat.id,'نوع باید percent یا fixed و مقدار مثبت باشد.');return true;}
    try{await env.DB.prepare('INSERT INTO discount_codes(code,discount_type,value,min_total,max_uses,enabled) VALUES(?,?,?,?,?,1)').bind(code,type,value,min,max).run();}catch{await send(env,m.chat.id,'❌ این کد احتمالاً قبلاً وجود دارد.');return true;}await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();await logAdmin(env,uid,'discount_create','discount',code,`${type}:${value}`);await send(env,m.chat.id,'✅ کد تخفیف ساخته شد.',[[{text:'🏷 کدهای تخفیف',callback_data:'admin:discounts'}]]);return true;
  }
  if(state==='admin_risk_lookup'){const target=Number(text);if(!Number.isSafeInteger(target)||target<=0){await send(env,m.chat.id,'Telegram ID عددی معتبر بفرست.');return true;}await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();const mm=await send(env,m.chat.id,'در حال باز کردن...');await adminRiskUser(env,m.chat.id,mm.result.message_id,target);return true;}
  if(state.startsWith('admin_risk_limit:')){const target=Number(state.split(':')[1]);let v:number|null=null;if(text.toUpperCase()!=='OFF'){const n=Number(text);if(!Number.isFinite(n)||n<=0){await send(env,m.chat.id,'عدد مثبت یا OFF بفرست.');return true;}v=n;}await env.DB.batch([env.DB.prepare('UPDATE users SET purchase_limit=? WHERE telegram_id=?').bind(v,target),env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)]);await logAdmin(env,uid,'risk_limit','user',String(target),String(v));const mm=await send(env,m.chat.id,'✅ ذخیره شد.');await adminRiskUser(env,m.chat.id,mm.result.message_id,target);return true;}
  if(state.startsWith('admin_rate_set:')){const pair=state.split(':')[1];const n=Number(text);if(!Number.isFinite(n)||n<=0){await send(env,m.chat.id,'نرخ معتبر بفرست.');return true;}if(pair==='USDTRY'){await setSetting(env,'rate_usd_try_mode','manual');await setSetting(env,'rate_usd_try_manual',String(n));}else if(pair==='USDIRR'){await setSetting(env,'rate_usd_irr_mode','manual');await setSetting(env,'rate_usd_irr_manual',String(n));}await setRateQuote(env,pair,n,'manual','manual');await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();const mm=await send(env,m.chat.id,'✅ نرخ ذخیره شد.');await adminRates(env,m.chat.id,mm.result.message_id);return true;}

  if(state==='admin_referral_amount'){const n=Number(text);if(!Number.isFinite(n)||n<0||n>100000){await send(env,m.chat.id,'مقدار معتبر بفرست.');return true;}await setSetting(env,'referral_reward_amount',String(n));await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();const mm=await send(env,m.chat.id,'✅ ذخیره شد.');await adminReferralSettings(env,m.chat.id,mm.result.message_id);return true;}

  if(state.startsWith('admin_risk_note:')){const target=Number(state.split(':')[1]);await env.DB.batch([env.DB.prepare('UPDATE users SET risk_note=? WHERE telegram_id=?').bind(text.slice(0,1000),target),env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)]);await logAdmin(env,uid,'risk_note','user',String(target),text.slice(0,200));const mm=await send(env,m.chat.id,'✅ یادداشت ذخیره شد.');await adminRiskUser(env,m.chat.id,mm.result.message_id,target);return true;}
  if(state.startsWith('admin_blacklist_add:')){const kind=state.split(':')[1] as 'wallet'|'txid'|'username';let value=text.trim();if(kind==='username')value=value.replace(/^@/,'').toLowerCase();else value=value.toLowerCase();if(!value||value.length>200){await send(env,m.chat.id,'مقدار معتبر بفرست.');return true;}try{await env.DB.prepare('INSERT INTO risk_blacklist(kind,value,created_by) VALUES(?,?,?)').bind(kind,value,uid).run();}catch{}await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();const mm=await send(env,m.chat.id,'✅ به Blacklist اضافه شد.');await adminBlacklist(env,m.chat.id,mm.result.message_id);return true;}
  if(state==='admin_blacklist_remove'){const [kind,...rest]=text.trim().split(/\s+/);let value=rest.join(' ').trim().toLowerCase();if(!['wallet','txid','username'].includes(kind)||!value){await send(env,m.chat.id,'فرمت: <code>username testuser</code> یا <code>txid abc...</code>');return true;}await env.DB.prepare('DELETE FROM risk_blacklist WHERE kind=? AND lower(value)=?').bind(kind,value.replace(/^@/,'')).run();await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();const mm=await send(env,m.chat.id,'✅ حذف شد.');await adminBlacklist(env,m.chat.id,mm.result.message_id);return true;}

  return false;
}

async function handleMessage(env:Env,m:Message){
  if(!m.from)return; const uid=m.from.id; const text=m.text||'';
  let startParam:string|undefined; if(text.startsWith('/start'))startParam=text.split(' ')[1]; await upsertUser(env,m.from,startParam);
  const admin=isAdmin(env,uid);const access=await getUserAccess(env,uid);const usernameBlocked=await isBlacklisted(env,'username',m.from.username||'');if((Number(access.banned)||usernameBlocked)&&!admin){await send(env,m.chat.id,'⛔ دسترسی حساب شما محدود شده است. برای پیگیری با پشتیبانی تماس بگیر.');return;}if(await maintenanceOn(env)&&!admin){await send(env,m.chat.id,'🧰 ربات موقتاً در حالت نگهداری است. لطفاً کمی بعد دوباره تلاش کن.');return;}
  if(text.startsWith('/start')){if(!admin&&await joinGate(env,uid,m.chat.id))return; await showMenu(env,m.chat.id);return;}
  if(text==='/admin'&&admin){await showAdmin(env,m.chat.id);return;}
  if(!admin&&await joinGate(env,uid,m.chat.id))return;
  const u:any=await env.DB.prepare('SELECT state FROM users WHERE telegram_id=?').bind(uid).first(); const state=String(u?.state||'');
  if(state&&isAdmin(env,uid)&&await handleAdminState(env,m,state))return;
  if(state.startsWith('await_card_receipt:')&&(m.photo?.length||m.document)){
    const pub=state.split(':')[1]; const inv:any=await env.DB.prepare("SELECT * FROM payment_invoices WHERE public_id=? AND telegram_id=? AND status='awaiting_receipt'").bind(pub,uid).first();
    if(!inv){await send(env,m.chat.id,'این فاکتور دیگر قابل ارسال نیست.');return;}
    const isDoc=!!m.document; const fileId=isDoc?m.document!.file_id:m.photo![m.photo!.length-1].file_id;
    await env.DB.batch([env.DB.prepare("UPDATE payment_invoices SET status='manual_review',receipt_file_id=? WHERE id=?").bind(fileId,inv.id),env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid)]); await notifyAdminsCardReceipt(env,inv,m.from,fileId,isDoc);
    await send(env,m.chat.id,`✅ رسید فاکتور <code>${pub}</code> دریافت شد.\nپس از بررسی ادمین نتیجه همین‌جا اعلام می‌شود.`,[[{text:'🏠 منوی اصلی',callback_data:'menu'}]]);return;
  }
  if(state==='await_custom_credit'&&/^\d+(\.\d+)?$/.test(text.trim())){
    const usd=Number(text); if(usd<=0||usd>10000){await send(env,m.chat.id,'مبلغ معتبر وارد کن.');return;} const credits=usd/Number(env.CREDIT_USD_PRICE||1); await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); const mm=await send(env,m.chat.id,'در حال آماده‌سازی...'); await paymentMethods(env,m.chat.id,mm.result.message_id,usd,credits);return;
  }
  if(state.startsWith('await_discount:')){
    const [,pidRaw,qtyRaw]=state.split(':'); const pid=Number(pidRaw),qty=Number(qtyRaw); const code=text.trim().toUpperCase(); const p:any=await env.DB.prepare('SELECT price_credits FROM products WHERE id=? AND enabled=1').bind(pid).first(); const subtotal=Number(p?.price_credits||0)*qty;
    const d:any=await env.DB.prepare("SELECT * FROM discount_codes WHERE code=? COLLATE NOCASE AND enabled=1 AND (expires_at IS NULL OR datetime(expires_at)>datetime('now'))").bind(code).first();
    if(!d||Number(d.min_total||0)>subtotal||(d.max_uses!==null&&Number(d.uses_count)>=Number(d.max_uses))){await send(env,m.chat.id,'❌ کد تخفیف معتبر نیست یا شرایط استفاده را ندارد.');return;}
    await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); const mm=await send(env,m.chat.id,'✅ کد اعمال شد.'); await showOrderSummary(env,uid,m.chat.id,mm.result.message_id,pid,qty,Number(d.id));return;
  }
  if(state.startsWith('await_ticket:')){await createTicketFromMessage(env,m,state);return;}
  if(state.startsWith('ticket_continue:')){
    const tid=Number(state.split(':')[1]); const t:any=await env.DB.prepare('SELECT * FROM support_tickets WHERE id=? AND telegram_id=?').bind(tid,uid).first(); if(t){await forwardUserTicketMessage(env,m,t); await send(env,m.chat.id,'✅ پیام به پشتیبانی ارسال شد.');return;}
  }
  await showMenu(env,m.chat.id);
}

async function handleCallback(env:Env,c:CallbackQuery){
  if(!c.message||!c.data)return; const uid=c.from.id,chat=c.message.chat.id,mid=c.message.message_id,d=c.data; await upsertUser(env,c.from);
  const admin=isAdmin(env,uid);const access=await getUserAccess(env,uid);const usernameBlocked=await isBlacklisted(env,'username',c.from.username||'');if((Number(access.banned)||usernameBlocked)&&!admin){await answerCb(env,c.id,'دسترسی حساب محدود شده است.',true);return;}if(await maintenanceOn(env)&&!admin){await answerCb(env,c.id,'ربات در حالت نگهداری است.',true);return;}
  if(d==='join:check'){
    const missing=await checkJoin(env,uid); if(missing.length){await answerCb(env,c.id,'هنوز عضویت همه کانال‌ها تأیید نشده.',true);await joinGate(env,uid,chat,mid);return;} await answerCb(env,c.id,'عضویت تأیید شد ✅'); await env.DB.prepare('UPDATE users SET join_verified=1 WHERE telegram_id=?').bind(uid).run(); await qualifyReferral(env,uid); await showMenu(env,chat,mid);return;
  }
  if(!admin&&await joinGate(env,uid,chat,mid)){await answerCb(env,c.id);return;} await answerCb(env,c.id);
  if(d.startsWith('shop:')&&!(await featureEnabled(env,'feature_shop',true)))return answerCb(env,c.id,'فروشگاه موقتاً غیرفعال است.',true);
  if(d.startsWith('support:')&&!(await featureEnabled(env,'feature_support',true)))return answerCb(env,c.id,'پشتیبانی موقتاً غیرفعال است.',true);
  if(d==='menu'){await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();return showMenu(env,chat,mid);}
  if(d==='balance')return showBalance(env,uid,chat,mid);
  if(d==='credit:buy')return showCreditPackages(env,chat,mid);
  if(d==='credit:custom'){await env.DB.prepare("UPDATE users SET state='await_custom_credit' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'✏️ مبلغ دلخواه را به دلار وارد کن.\nمثال: <code>27</code>',[[{text:'⬅️ بازگشت',callback_data:'credit:buy'}]]);}
  if(d.startsWith('credit:pkg:')){const id=Number(d.split(':')[2]); const p:any=await env.DB.prepare('SELECT * FROM credit_packages WHERE id=? AND enabled=1').bind(id).first(); if(p)return paymentMethods(env,chat,mid,Number(p.pay_usd),Number(p.credits));}
  if(d.startsWith('pay:crypto:')){if(!(await featureEnabled(env,'feature_crypto',true)))return answerCb(env,c.id,'پرداخت کریپتو موقتاً غیرفعال است.',true);const parts=d.split(':');const network=parts[2],usd=Number(parts[3]),cr=Number(parts[4]);return showCryptoInvoice(env,chat,mid,uid,usd,cr,network);}
  if(d.startsWith('pay:card:')){if(!(await featureEnabled(env,'feature_card',true)))return answerCb(env,c.id,'کارت به کارت موقتاً غیرفعال است.',true);const parts=d.split(':');const usd=Number(parts[2]),cr=Number(parts[3]);return showCardInvoice(env,chat,mid,uid,usd,cr);}
  if(d.startsWith('pay:qr:')){await showPaymentQr(env,chat,uid,d.split(':')[2]);return;}
  if(d.startsWith('pay:check:')){const pub=d.split(':')[2]; const n=await scanPendingCrypto(env,pub,uid); if(n){await answerCb(env,c.id,'پرداخت تأیید شد ✅',true);return showBalance(env,uid,chat,mid);} return answerCb(env,c.id,'هنوز تراکنش مطابق فاکتور پیدا نشده.',true);}
  if(d.startsWith('pay:cancel:')){const pub=d.split(':')[2]; await env.DB.prepare("UPDATE payment_invoices SET status='cancelled' WHERE public_id=? AND telegram_id=? AND status IN ('pending','awaiting_receipt')").bind(pub,uid).run(); await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run(); return showMenu(env,chat,mid);}
  if(d==='shop:list'){if(!(await featureEnabled(env,'feature_shop',true)))return answerCb(env,c.id,'فروشگاه موقتاً غیرفعال است.',true);return showShop(env,chat,mid);}
  if(d.startsWith('shop:cat:')){const x=d.split(':');return showCategoryProducts(env,chat,mid,Number(x[2]),Number(x[3])||0);}
  if(d.startsWith('shop:p:'))return showProduct(env,chat,mid,Number(d.split(':')[2]));
  if(d.startsWith('shop:summary:')){const x=d.split(':');return showOrderSummary(env,uid,chat,mid,Number(x[2]),Number(x[3]),Number(x[4])||0);}
  if(d.startsWith('shop:discount:')){const x=d.split(':');await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`await_discount:${x[2]}:${x[3]}`,uid).run();return edit(env,chat,mid,'🏷 <b>کد تخفیف را ارسال کن</b>\n\nکد را بدون فاصله اضافی بفرست.',[[{text:'⬅️ بازگشت',callback_data:`shop:summary:${x[2]}:${x[3]}:0`}]]);}
  if(d.startsWith('shop:buy:')){const x=d.split(':');return buyProduct(env,uid,chat,mid,Number(x[2]),Number(x[3]),Number(x[4])||0);}
  if(d==='history:menu')return showHistoryMenu(env,chat,mid);
  if(d.startsWith('history:shop:'))return showShopHistory(env,uid,chat,mid,Number(d.split(':')[2])||0);
  if(d.startsWith('history:pay:'))return showPaymentHistory(env,uid,chat,mid,Number(d.split(':')[2])||0);
  if(d==='referral'){if(!(await featureEnabled(env,'feature_referral',true)))return answerCb(env,c.id,'Referral موقتاً غیرفعال است.',true);return showReferral(env,uid,chat,mid);}
  if(d==='status')return edit(env,chat,mid,'🟢 <b>وضعیت سرویس</b>\n\n🟢 Telegram Bot\n🟢 Cloudflare Worker\n🟢 D1 Database\n🟢 Shop Engine\n🟢 Payment Scanner\n🟢 Support Tickets',[[{text:'⬅️ منوی اصلی',callback_data:'menu'}]]);
  if(d==='support:menu'){if(!(await featureEnabled(env,'feature_support',true)))return answerCb(env,c.id,'پشتیبانی موقتاً غیرفعال است.',true);await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();return showSupportMenu(env,chat,mid);}
  if(d==='support:orders')return showSupportOrders(env,uid,chat,mid);
  if(d.startsWith('support:new:'))return beginTicket(env,uid,chat,mid,d.split(':')[2]);
  if(d.startsWith('support:order:'))return beginTicket(env,uid,chat,mid,'shop',Number(d.split(':')[2]));
  if(d==='support:mine')return showMyTickets(env,uid,chat,mid);
  if(d==='support:cancel'){await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();return showSupportMenu(env,chat,mid);}
  if(d.startsWith('support:continue:')){const tid=Number(d.split(':')[2]); const t:any=await env.DB.prepare('SELECT id FROM support_tickets WHERE id=? AND telegram_id=?').bind(tid,uid).first(); if(!t)return; await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`ticket_continue:${tid}`,uid).run(); return edit(env,chat,mid,'✍️ پیام بعدی را بفرست. متن، عکس یا فایل قابل ارسال است.',[[{text:'⬅️ پشتیبانی',callback_data:'support:menu'}]]);}

  if(!isAdmin(env,uid))return;
  if(d==='admin:home'){await env.DB.prepare('UPDATE users SET state=NULL WHERE telegram_id=?').bind(uid).run();return showAdmin(env,chat,mid);}
  if(d.startsWith('admin:section:'))return adminSection(env,chat,mid,d.split(':')[2]);
  if(d==='admin:features')return adminFeatures(env,chat,mid);
  if(d==='admin:referral:settings')return adminReferralSettings(env,chat,mid);
  if(d==='admin:referral:trigger'){const rs=await referralSettings(env);await setSetting(env,'referral_reward_trigger',rs.trigger==='first_purchase'?'join':'first_purchase');return adminReferralSettings(env,chat,mid);}
  if(d==='admin:referral:amount'){await env.DB.prepare("UPDATE users SET state='admin_referral_amount' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'پاداش پایه Referral را به Credit بفرست.');}
  if(d.startsWith('admin:feature:')){const key=d.slice('admin:feature:'.length);const allowed=new Set(['feature_shop','feature_crypto','feature_card','feature_referral','feature_support','feature_broadcast']);if(allowed.has(key)){await setSetting(env,key,(await featureEnabled(env,key,true))?'0':'1');await logAdmin(env,uid,'feature_toggle','setting',key);}return adminFeatures(env,chat,mid);}
  if(d==='admin:maintenance')return adminMaintenance(env,chat,mid);
  if(d==='admin:maintenance:toggle'){await setSetting(env,'maintenance_mode',(await maintenanceOn(env))?'0':'1');await logAdmin(env,uid,'maintenance_toggle','setting','maintenance_mode');return adminMaintenance(env,chat,mid);}
  if(d==='admin:rates')return adminRates(env,chat,mid);
  if(d==='admin:rates:refresh'){await refreshRates(env,true);await answerCb(env,c.id,'نرخ‌ها بروزرسانی شدند.');return adminRates(env,chat,mid);}
  if(d.startsWith('admin:rate:set:')){const pair=d.split(':')[3];await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_rate_set:${pair}`,uid).run();return edit(env,chat,mid,`نرخ جدید <code>${pair}</code> را وارد کن.`);}
  if(d==='admin:risk')return adminRisk(env,chat,mid);
  if(d==='admin:risk:lookup'){await env.DB.prepare("UPDATE users SET state='admin_risk_lookup' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'Telegram ID کاربر را بفرست.');}
  if(d.startsWith('admin:risk:ban:')){const target=Number(d.split(':')[3]);await env.DB.prepare('UPDATE users SET banned=CASE banned WHEN 1 THEN 0 ELSE 1 END WHERE telegram_id=?').bind(target).run();await logAdmin(env,uid,'risk_ban_toggle','user',String(target));return adminRiskUser(env,chat,mid,target);}
  if(d.startsWith('admin:risk:ref:')){const target=Number(d.split(':')[3]);await env.DB.prepare('UPDATE users SET referral_disabled=CASE referral_disabled WHEN 1 THEN 0 ELSE 1 END WHERE telegram_id=?').bind(target).run();await logAdmin(env,uid,'risk_referral_toggle','user',String(target));return adminRiskUser(env,chat,mid,target);}
  if(d.startsWith('admin:risk:level:')){const target=Number(d.split(':')[3]);const u:any=await env.DB.prepare('SELECT risk_level FROM users WHERE telegram_id=?').bind(target).first();const next=u?.risk_level==='high'?'normal':u?.risk_level==='watch'?'high':'watch';await env.DB.prepare('UPDATE users SET risk_level=? WHERE telegram_id=?').bind(next,target).run();await logAdmin(env,uid,'risk_level','user',String(target),next);return adminRiskUser(env,chat,mid,target);}
  if(d.startsWith('admin:risk:limit:')){const target=Number(d.split(':')[3]);await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_risk_limit:${target}`,uid).run();return edit(env,chat,mid,'سقف خرید را به Credit بفرست یا <code>OFF</code> برای نامحدود.');}
  if(d.startsWith('admin:risk:note:')){const target=Number(d.split(':')[3]);await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_risk_note:${target}`,uid).run();return edit(env,chat,mid,'یادداشت داخلی ادمین را بفرست.');}
  if(d==='admin:blacklist')return adminBlacklist(env,chat,mid);
  if(d.startsWith('admin:blacklist:add:')){const kind=d.split(':')[3];await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_blacklist_add:${kind}`,uid).run();return edit(env,chat,mid,`مقدار ${kind} را بفرست.`);}
  if(d==='admin:blacklist:remove'){await env.DB.prepare("UPDATE users SET state='admin_blacklist_remove' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'برای حذف فرمت <code>kind value</code> را بفرست؛ مثال: <code>username testuser</code>');}
  if(d==='admin:scan'){const n=await scanPendingCrypto(env); await logAdmin(env,uid,'crypto_scan',undefined,undefined,`settled=${n}`);return answerCb(env,c.id,`${n} پرداخت جدید تأیید شد.`,true);}
  if(d==='admin:bep20:mode'){const b=await bep20Status(env);await setSetting(env,'bep20_test_mode',b.testMode?'0':'1');await logAdmin(env,uid,'bep20_mode','setting','bep20_test_mode',b.testMode?'live':'test');return adminPayments(env,chat,mid);}
  if(d==='admin:bep20:toggle'){const b=await bep20Status(env);await setSetting(env,'feature_bep20',b.enabled?'0':'1');await logAdmin(env,uid,'bep20_toggle','setting','feature_bep20',b.enabled?'off':'on');return adminPayments(env,chat,mid);}
  if(d==='admin:bep20:testinvoice'){
    const b=await bep20Status(env);if(!b.testMode)return answerCb(env,c.id,'BEP20 در حالت LIVE است.',true);if(!b.ready)return answerCb(env,c.id,'تنظیمات BEP20 کامل نیست.',true);
    await answerCb(env,c.id,'فاکتور تست ساخته شد.');return showCryptoInvoice(env,chat,mid,uid,0.10,0.10,'BEP20');
  }
  if(d==='admin:bep20:check'||d.startsWith('admin:paytest:')){
    const which=d==='admin:bep20:check'?'bep20':d.split(':')[2];
    await answerCb(env,c.id,'در حال تست…');
    const items=await paymentDiagnostics(env,which);
    const rows:Btn[][]=[[{text:'🔄 تست دوباره',callback_data:`admin:paytest:${which}`}],[{text:'⬅️ تنظیمات پرداخت',callback_data:'admin:payments'}]];
    return edit(env,chat,mid,diagnosticsTelegramText(items),rows);
  }
  if(d==='admin:products')return adminProducts(env,chat,mid);
  if(d==='admin:categories')return adminCategories(env,chat,mid);
  if(d==='admin:channels')return adminChannels(env,chat,mid);
  if(d==='admin:discounts')return adminDiscounts(env,chat,mid);
  if(d==='admin:payments')return adminPayments(env,chat,mid);
  if(d==='admin:orders')return adminOrders(env,chat,mid);
  if(d.startsWith('admin:order:refund:')){const id=Number(d.split(':')[3]);const o=await refundOrder(env,uid,id);if(!o)return answerCb(env,c.id,'این سفارش قابل Refund نیست.',true);await answerCb(env,c.id,'Refund انجام شد ✅',true);return adminOrderDetail(env,chat,mid,id);}
  if(d.startsWith('admin:order:'))return adminOrderDetail(env,chat,mid,Number(d.split(':')[2]));
  if(d==='admin:category:new'){await env.DB.prepare("UPDATE users SET state='admin_category_new' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'➕ نام دسته را بفرست. می‌توانی اولش ایموجی هم بگذاری.\nمثال: <code>🤖 هوش مصنوعی</code>',[[{text:'⬅️ لغو',callback_data:'admin:categories'}]]);}
  if(d.startsWith('admin:category:toggle:')){const id=Number(d.split(':')[3]);await env.DB.prepare('UPDATE shop_categories SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id=?').bind(id).run();await logAdmin(env,uid,'category_toggle','category',String(id));return adminCategories(env,chat,mid);}
  if(d.startsWith('admin:product:category:'))return adminProductCategory(env,chat,mid,Number(d.split(':')[3]));
  if(d.startsWith('admin:product:setcat:')){const x=d.split(':');const pid=Number(x[3]),cid=Number(x[4]);await env.DB.prepare('UPDATE products SET category_id=? WHERE id=?').bind(cid,pid).run();await logAdmin(env,uid,'product_category','product',String(pid),`category=${cid}`);return adminProductDetail(env,chat,mid,pid);}
  if(d==='admin:channel:new'){await env.DB.prepare("UPDATE users SET state='admin_channel_new_chat' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'📢 Chat ID کانال/گروه را بفرست.\nمثال: <code>-1001234567890</code>',[[{text:'⬅️ لغو',callback_data:'admin:channels'}]]);}
  if(d.startsWith('admin:channel:toggle:')){const id=Number(d.split(':')[3]);await env.DB.prepare('UPDATE required_channels SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id=?').bind(id).run();await logAdmin(env,uid,'channel_toggle','channel',String(id));return adminChannels(env,chat,mid);}
  if(d.startsWith('admin:channel:delete:')){const id=Number(d.split(':')[3]);await env.DB.prepare('DELETE FROM required_channels WHERE id=?').bind(id).run();await logAdmin(env,uid,'channel_delete','channel',String(id));return adminChannels(env,chat,mid);}
  if(d==='admin:discount:new'){await env.DB.prepare("UPDATE users SET state='admin_discount_new' WHERE telegram_id=?").bind(uid).run();return edit(env,chat,mid,'🏷 مشخصات کد را در یک خط بفرست.\n\n<code>WELCOME percent 10 5 100</code>\nیا\n<code>SAVE2 fixed 2 5 50</code>\n\nترتیب: CODE / type / value / min-total / max-uses',[[{text:'⬅️ لغو',callback_data:'admin:discounts'}]]);}
  if(d.startsWith('admin:discount:toggle:')){const id=Number(d.split(':')[3]);await env.DB.prepare('UPDATE discount_codes SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id=?').bind(id).run();await logAdmin(env,uid,'discount_toggle','discount',String(id));return adminDiscounts(env,chat,mid);}
  if(d.startsWith('admin:payset:')){const key=d.split(':')[2];await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_setting:${key}`,uid).run();return edit(env,chat,mid,`✏️ مقدار جدید <code>${esc(key)}</code> را بفرست.\nبرای غیرفعال‌کردن <code>OFF</code> بفرست.`,[[{text:'⬅️ لغو',callback_data:'admin:payments'}]]);}
  if(d==='admin:tonrate:auto'){await setSetting(env,'ton_rate_mode','auto');await refreshTonRate(env,true);await logAdmin(env,uid,'ton_rate_mode','setting','ton_rate_mode','auto');return adminPayments(env,chat,mid);}
  if(d==='admin:tonrate:manual'){await setSetting(env,'ton_rate_mode','manual');await logAdmin(env,uid,'ton_rate_mode','setting','ton_rate_mode','manual');return adminPayments(env,chat,mid);}
  if(d==='admin:tonrate:refresh'){const r=await refreshTonRate(env,true);await answerCb(env,c.id,r?`نرخ جدید: $${r}`:'دریافت نرخ ناموفق بود.',!r);return adminPayments(env,chat,mid);}
  if(d.startsWith('admin:product:toggle:')){const pid=Number(d.split(':')[3]); await env.DB.prepare('UPDATE products SET enabled=CASE enabled WHEN 1 THEN 0 ELSE 1 END WHERE id=?').bind(pid).run(); await logAdmin(env,uid,'product_toggle','product',String(pid)); return adminProductDetail(env,chat,mid,pid);}
  if(d.startsWith('admin:product:price:')){const pid=Number(d.split(':')[3]); await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_price:${pid}`,uid).run(); return edit(env,chat,mid,'💎 قیمت جدید را به Credit بفرست. مثال: <code>0.70</code>',[[{text:'⬅️ لغو',callback_data:`admin:product:${pid}`}]]);}
  if(d==='admin:product:new'){await env.DB.prepare("UPDATE users SET state='admin_product_new_title' WHERE telegram_id=?").bind(uid).run(); return edit(env,chat,mid,'➕ <b>محصول جدید</b>\n\nنام محصول را بفرست.',[[{text:'⬅️ لغو',callback_data:'admin:products'}]]);}
  if(d.startsWith('admin:product:'))return adminProductDetail(env,chat,mid,Number(d.split(':')[2]));
  if(d==='admin:stock')return adminStock(env,chat,mid);
  if(d.startsWith('admin:stock:add:')){const pid=Number(d.split(':')[3]); await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_stock:${pid}`,uid).run(); return edit(env,chat,mid,'📦 استوک‌ها را بفرست؛ <b>هر مورد در یک خط</b>.\n\nمثال:\n<code>LINK-1\nLINK-2\nLINK-3</code>',[[{text:'⬅️ لغو',callback_data:`admin:product:${pid}`}]]);}
  if(d==='admin:tickets')return adminTickets(env,chat,mid);
  if(d.startsWith('admin:ticket:view:'))return adminTicketView(env,chat,mid,Number(d.split(':')[3]));
  if(d.startsWith('admin:ticket:reply:')){const tid=Number(d.split(':')[3]); await env.DB.prepare('UPDATE users SET state=? WHERE telegram_id=?').bind(`admin_ticket_reply:${tid}`,uid).run(); return edit(env,chat,mid,'💬 پاسخ را بفرست. متن، عکس یا فایل قابل ارسال است.',[[{text:'⬅️ لغو',callback_data:`admin:ticket:view:${tid}`}]]);}
  if(d.startsWith('admin:ticket:close:')){const tid=Number(d.split(':')[3]); const t:any=await env.DB.prepare('SELECT * FROM support_tickets WHERE id=?').bind(tid).first(); if(t){await env.DB.prepare("UPDATE support_tickets SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(tid).run(); await send(env,t.telegram_id,`✅ تیکت <code>${t.public_id}</code> توسط پشتیبانی بسته شد.`); await logAdmin(env,uid,'ticket_close','ticket',t.public_id);} return adminTickets(env,chat,mid);}
  if(d==='admin:broadcast'){if(!(await featureEnabled(env,'feature_broadcast',true)))return answerCb(env,c.id,'Broadcast غیرفعال است.',true);await env.DB.prepare("UPDATE users SET state='admin_broadcast' WHERE telegram_id=?").bind(uid).run(); return edit(env,chat,mid,'📢 متن Broadcast را بفرست.\n\nپیام در صف قرار می‌گیرد و Cron آن را مرحله‌ای ارسال می‌کند.',[[{text:'⬅️ لغو',callback_data:'admin:home'}]]);}
  if(d==='admin:stats')return adminStats(env,chat,mid);
  if(d.startsWith('admin:cryptoissue:')){
    const [, ,action,pub]=d.split(':');const inv:any=await env.DB.prepare("SELECT * FROM payment_invoices WHERE public_id=? AND method='crypto' AND status='manual_review'").bind(pub).first();if(!inv)return answerCb(env,c.id,'این مورد قبلاً بررسی شده.',true);
    if(action==='approve'){const claim=randomHex(18),hash=String(inv.tx_hash||'').toLowerCase();try{await env.DB.batch([env.DB.prepare("INSERT INTO payment_settlements(invoice_id,claim_token,tx_hash,settlement_kind) SELECT id,?,?,'crypto_manual' FROM payment_invoices WHERE id=? AND status='manual_review'").bind(claim,hash,inv.id),env.DB.prepare("UPDATE payment_invoices SET status='paid',paid_at=CURRENT_TIMESTAMP,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='manual_review' AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(uid,inv.id,inv.id,claim),env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT telegram_id,credit_amount,'topup','payment',public_id,'تأیید دستی پرداخت کریپتو' FROM payment_invoices WHERE id=? AND status='paid' AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(inv.id,inv.id,claim)]);}catch{return answerCb(env,c.id,'قابل تأیید نیست یا تراکنش قبلاً استفاده شده.',true);}await send(env,inv.telegram_id,`✅ پرداخت <code>${pub}</code> توسط ادمین تأیید شد و ${Number(inv.credit_amount).toFixed(2)} Credit اضافه شد.`);await logAdmin(env,uid,'crypto_manual_approve','payment',pub);return answerCb(env,c.id,'تأیید شد ✅',true);}
    await env.DB.prepare("UPDATE payment_invoices SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='manual_review'").bind(uid,inv.id).run();await send(env,inv.telegram_id,`❌ پرداخت <code>${pub}</code> پس از بررسی تأیید نشد. در صورت نیاز با پشتیبانی تماس بگیر.`);await logAdmin(env,uid,'crypto_manual_reject','payment',pub);return answerCb(env,c.id,'رد شد.',true);
  }
  if(d.startsWith('admin:card:')){
    const [, ,action,pub]=d.split(':'); const inv:any=await env.DB.prepare("SELECT * FROM payment_invoices WHERE public_id=? AND method='card' AND status='manual_review'").bind(pub).first(); if(!inv)return answerCb(env,c.id,'این درخواست قبلاً بررسی شده.',true);
    if(action==='approve'){
      const claim=randomHex(18),guard=`card:${claim}`;
      try{await env.DB.batch([
        env.DB.prepare("INSERT INTO payment_settlements(invoice_id,claim_token,settlement_kind) SELECT id,?,'card' FROM payment_invoices WHERE id=? AND status='manual_review'").bind(claim,inv.id),
        env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?) THEN 1 ELSE 0 END").bind(guard,inv.id,claim),
        env.DB.prepare("UPDATE payment_invoices SET status='paid',paid_at=CURRENT_TIMESTAMP,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='manual_review' AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(uid,inv.id,inv.id,claim),
        env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) SELECT telegram_id,credit_amount,'topup','payment',public_id,'شارژ با کارت به کارت' FROM payment_invoices WHERE id=? AND status='paid' AND EXISTS(SELECT 1 FROM payment_settlements WHERE invoice_id=? AND claim_token=?)").bind(inv.id,inv.id,claim),
        env.DB.prepare("INSERT INTO security_guards(tag,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM credit_ledger WHERE kind='topup' AND ref_type='payment' AND ref_id=?) THEN 1 ELSE 0 END").bind(`${guard}:ledger`,inv.public_id),
        env.DB.prepare('DELETE FROM security_guards WHERE tag IN (?,?)').bind(guard,`${guard}:ledger`)
      ]);}catch{return answerCb(env,c.id,'این درخواست قبلاً بررسی شده یا قابل تأیید نیست.',true);}
      await send(env,inv.telegram_id,`✅ پرداخت کارت به کارت <code>${pub}</code> تأیید شد.
💎 ${Number(inv.credit_amount).toFixed(2)} Credit اضافه شد.`,[[{text:'💰 موجودی',callback_data:'balance'}]]); await logAdmin(env,uid,'card_approve','payment',pub); return answerCb(env,c.id,'تأیید شد ✅',true);
    }
    const rej=await env.DB.prepare("UPDATE payment_invoices SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='manual_review'").bind(uid,inv.id).run(); if(!rej.meta.changes)return answerCb(env,c.id,'این درخواست قبلاً بررسی شده.',true); await send(env,inv.telegram_id,`❌ رسید فاکتور <code>${pub}</code> توسط ادمین تأیید نشد.\nدر صورت نیاز با پشتیبانی تماس بگیر.`); await logAdmin(env,uid,'card_reject','payment',pub); return answerCb(env,c.id,'رد شد.',true);
  }
}

async function handleUpdate(env:Env,u:Update){if(u.message)await handleMessage(env,u.message); else if(u.callback_query)await handleCallback(env,u.callback_query)}


function webEsc(v:any=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));}
function cookieValue(req:Request,name:string){
  const raw=req.headers.get('cookie')||''; for(const part of raw.split(';')){const i=part.indexOf('=');if(i<0)continue;if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim());} return '';
}
async function hmacHex(secret:string,text:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))); return Array.from(sig).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(text:string){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return Array.from(d).map(b=>b.toString(16).padStart(2,'0')).join('');}
function safeEq(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function requestIp(req:Request){return req.headers.get('CF-Connecting-IP')||'unknown';}
async function loginIpHash(req:Request,env:Env){return hmacHex(env.ADMIN_SESSION_SECRET||'nexora',requestIp(req));}
async function isLoginBlocked(req:Request,env:Env){const ip=await loginIpHash(req,env);const r:any=await env.DB.prepare("SELECT blocked_until FROM admin_login_attempts WHERE ip_hash=? AND blocked_until IS NOT NULL AND datetime(blocked_until)>datetime('now')").bind(ip).first();return !!r;}
async function recordLoginFailure(req:Request,env:Env){const ip=await loginIpHash(req,env);await env.DB.prepare("INSERT INTO admin_login_attempts(ip_hash,attempts,window_started,updated_at) VALUES(?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN datetime(window_started)<=datetime('now','-15 minutes') THEN 1 ELSE attempts+1 END,window_started=CASE WHEN datetime(window_started)<=datetime('now','-15 minutes') THEN CURRENT_TIMESTAMP ELSE window_started END,blocked_until=CASE WHEN (CASE WHEN datetime(window_started)<=datetime('now','-15 minutes') THEN 1 ELSE attempts+1 END)>=5 THEN datetime('now','+30 minutes') ELSE blocked_until END,updated_at=CURRENT_TIMESTAMP").bind(ip).run();}
async function clearLoginFailures(req:Request,env:Env){await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(await loginIpHash(req,env)).run();}
async function makeAdminSession(req:Request,env:Env){const token=randomHex(32),hash=await sha256Hex(token),csrf=randomHex(24),exp=new Date(Date.now()+12*60*60*1000).toISOString();const ip=await loginIpHash(req,env),ua=await sha256Hex(req.headers.get('user-agent')||'');await env.DB.prepare('INSERT INTO admin_sessions(token_hash,csrf_token,expires_at,ip_hash,user_agent_hash) VALUES(?,?,?,?,?)').bind(hash,csrf,exp,ip,ua).run();return {token,csrf};}
async function validAdminSession(req:Request,env:Env){
  if(!env.ADMIN_WEB_PASSWORD||!env.ADMIN_SESSION_SECRET)return null; const token=cookieValue(req,'nexora_admin'); if(!token)return null; const hash=await sha256Hex(token); const row:any=await env.DB.prepare("SELECT * FROM admin_sessions WHERE token_hash=? AND datetime(expires_at)>datetime('now')").bind(hash).first();return row||null;
}
async function revokeAdminSession(req:Request,env:Env){const token=cookieValue(req,'nexora_admin');if(token)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256Hex(token)).run();}
function injectCsrf(body:string,csrf:string){return body.replace(/(<form\b[^>]*method=["']post["'][^>]*>)/gi,`$1<input type="hidden" name="csrf" value="${webEsc(csrf)}">`);}
function webPage(title:string,body:string,active='dashboard',csrf=''){
  const nav=(id:string,label:string)=>`<a class="${active===id?'active':''}" href="/admin-web?tab=${id}">${label}</a>`;
  const html=`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${webEsc(title)} · Nexora</title><style>
  :root{color-scheme:dark;--bg:#0b1020;--panel:#121a2d;--muted:#91a0bd;--line:#24314e;--accent:#7aa2ff;--good:#46d39a;--bad:#ff6b7a}*{box-sizing:border-box}body{margin:0;background:linear-gradient(160deg,#090e1c,#11192d);color:#f4f7ff;font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif}.wrap{max-width:1180px;margin:auto;padding:22px}.top{display:flex;gap:14px;align-items:center;justify-content:space-between;margin-bottom:18px}.brand{font-weight:800;font-size:20px}.sub{color:var(--muted);font-size:13px}.nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.nav a,.btn{color:#edf3ff;text-decoration:none;background:#17223c;border:1px solid var(--line);padding:9px 12px;border-radius:11px;cursor:pointer}.nav a.active{border-color:var(--accent);background:#20325b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.card{background:rgba(18,26,45,.94);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 12px 30px #0003}.metric{font-size:25px;font-weight:800;margin-top:6px}.muted{color:var(--muted)}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:10px 8px;border-bottom:1px solid var(--line);text-align:right;vertical-align:top}input,textarea,select{width:100%;background:#0d1528;color:#fff;border:1px solid var(--line);border-radius:10px;padding:10px}textarea{min-height:110px}.row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{margin-bottom:12px}.field label{display:block;margin-bottom:6px;color:#cbd6ec;font-size:13px}.btn.primary{background:#2b4f91;border-color:#4c75c5}.btn.good{background:#174837;border-color:#2c8a67}.btn.bad{background:#52202a;border-color:#93404f}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#1a2947;font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap}.ltr{direction:ltr;text-align:left}@media(max-width:700px){.row{grid-template-columns:1fr}.wrap{padding:12px}th:nth-child(n+5),td:nth-child(n+5){display:none}}
  </style></head><body><div class="wrap"><div class="top"><div><div class="brand">Nexora Commerce Bot</div><div class="sub">پنل مدیریت تحت وب</div></div><form method="post" action="/admin-web"><input type="hidden" name="action" value="logout"><button class="btn bad">خروج</button></form></div><div class="nav">${nav('dashboard','📊 داشبورد')}${nav('products','🛍 محصولات')}${nav('users','👥 کاربران')}${nav('orders','🧾 سفارش‌ها')}${nav('payments','💳 پرداخت و TON')}</div>${body}</div></body></html>`;
  return csrf?injectCsrf(html,csrf):html;
}
function loginPage(msg=''){
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexora Admin</title><style>body{margin:0;background:#0b1020;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.box{width:min(92vw,420px);background:#121a2d;border:1px solid #263454;border-radius:18px;padding:24px}input,button{width:100%;padding:12px;border-radius:10px;border:1px solid #314267;background:#0c1427;color:#fff;margin-top:10px}button{background:#315da8;cursor:pointer}.err{color:#ff8793}</style><div class="box"><h2>ورود به Nexora Admin</h2><p>رمز پنل مدیریت را وارد کن.</p>${msg?`<p class="err">${webEsc(msg)}</p>`:''}<form method="post" action="/admin-web"><input type="hidden" name="action" value="login"><input type="password" name="password" autocomplete="current-password" required><button>ورود</button></form></div></html>`,{headers:{'content-type':'text/html; charset=utf-8'}});
}
async function adminDashboardHtml(env:Env){
  const [users,orders,topups,tickets,stock,periods]=await Promise.all([
    env.DB.prepare('SELECT COUNT(*) c FROM users').first<any>(),
    env.DB.prepare("SELECT COUNT(*) c,COALESCE(SUM(total_price),0) revenue,COALESCE(SUM(cost_total),0) cost FROM orders WHERE status='completed'").first<any>(),
    env.DB.prepare("SELECT COUNT(*) c,COALESCE(SUM(requested_usd),0) usd FROM payment_invoices WHERE status='paid'").first<any>(),
    env.DB.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status='open'").first<any>(),
    env.DB.prepare("SELECT COUNT(*) c FROM product_stock WHERE status='available'").first<any>(),
    env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN date(created_at)=date('now') THEN total_price ELSE 0 END),0) today_revenue,COALESCE(SUM(CASE WHEN date(created_at)=date('now') THEN cost_total ELSE 0 END),0) today_cost,COALESCE(SUM(CASE WHEN datetime(created_at)>=datetime('now','-7 days') THEN total_price ELSE 0 END),0) week_revenue,COALESCE(SUM(CASE WHEN datetime(created_at)>=datetime('now','-7 days') THEN cost_total ELSE 0 END),0) week_cost,COALESCE(SUM(CASE WHEN datetime(created_at)>=datetime('now','-30 days') THEN total_price ELSE 0 END),0) month_revenue,COALESCE(SUM(CASE WHEN datetime(created_at)>=datetime('now','-30 days') THEN cost_total ELSE 0 END),0) month_cost FROM orders WHERE status='completed'").first<any>()
  ]);
  const gross=Number(orders?.revenue||0),cost=Number(orders?.cost||0),profit=gross-cost;
  const row=(label:string,revenue:any,costv:any)=>`<tr><td>${label}</td><td>${Number(revenue||0).toFixed(2)}</td><td>${Number(costv||0).toFixed(2)}</td><td>${(Number(revenue||0)-Number(costv||0)).toFixed(2)}</td></tr>`;
  return `<div class="grid"><div class="card"><div class="muted">کاربران</div><div class="metric">${Number(users?.c||0)}</div></div><div class="card"><div class="muted">سفارش تکمیل‌شده</div><div class="metric">${Number(orders?.c||0)}</div></div><div class="card"><div class="muted">فروش خالص</div><div class="metric">${gross.toFixed(2)} cr</div></div><div class="card"><div class="muted">سود تخمینی</div><div class="metric">${profit.toFixed(2)} cr</div></div><div class="card"><div class="muted">شارژهای تأییدشده</div><div class="metric">$${Number(topups?.usd||0).toFixed(2)}</div></div><div class="card"><div class="muted">تیکت باز / استوک</div><div class="metric">${Number(tickets?.c||0)} / ${Number(stock?.c||0)}</div></div></div><div class="card" style="margin-top:14px"><h3>عملکرد زمانی</h3><table><tr><th>بازه</th><th>فروش</th><th>هزینه</th><th>سود تخمینی</th></tr>${row('امروز',periods?.today_revenue,periods?.today_cost)}${row('۷ روز اخیر',periods?.week_revenue,periods?.week_cost)}${row('۳۰ روز اخیر',periods?.month_revenue,periods?.month_cost)}</table><p class="muted">سود = مبلغ فروش پس از تخفیف − هزینه ثبت‌شده محصول در زمان سفارش. برای سفارش‌های قدیمی قبل از v0.4، هزینه تاریخی ممکن است صفر باشد.</p></div>`;
}
async function adminProductsHtml(env:Env,url:URL){
  const editId=Number(url.searchParams.get('edit')||0); const cats:any=await env.DB.prepare('SELECT * FROM shop_categories ORDER BY sort_order,id').all();
  let editor='';
  if(editId){const p:any=await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(editId).first();if(p){editor=`<div class="card"><h3>ویرایش محصول #${p.id}</h3><form method="post" action="/admin-web"><input type="hidden" name="action" value="product_save"><input type="hidden" name="id" value="${p.id}"><div class="row"><div class="field"><label>نام</label><input name="title" value="${webEsc(p.title)}" required></div><div class="field"><label>دسته</label><select name="category_id">${(cats.results||[]).map((c:any)=>`<option value="${c.id}" ${Number(c.id)===Number(p.category_id)?'selected':''}>${webEsc(c.emoji)} ${webEsc(c.title)}</option>`).join('')}</select></div></div><div class="field"><label>توضیحات</label><textarea name="description">${webEsc(p.description||'')}</textarea></div><div class="row"><div class="field"><label>قیمت فروش (Credit)</label><input type="number" step="0.0001" min="0" name="price_credits" value="${Number(p.price_credits)}"></div><div class="field"><label>هزینه تمام‌شده (Credit)</label><input type="number" step="0.0001" min="0" name="cost_credits" value="${Number(p.cost_credits||0)}"></div></div><div class="row"><div class="field"><label>گارانتی</label><input name="warranty_text" value="${webEsc(p.warranty_text||'')}"></div><div class="field"><label>فرمت تحویل</label><input name="format_text" value="${webEsc(p.format_text||'')}"></div></div><div class="row"><div class="field"><label>ترتیب</label><input type="number" name="sort_order" value="${Number(p.sort_order||100)}"></div><div class="field"><label>وضعیت</label><select name="enabled"><option value="1" ${p.enabled?'selected':''}>فعال</option><option value="0" ${!p.enabled?'selected':''}>غیرفعال</option></select></div></div><button class="btn primary">ذخیره تغییرات</button></form></div>`;}}
  const q:any=await env.DB.prepare("SELECT p.*,c.title category_title,(SELECT COUNT(*) FROM product_stock s WHERE s.product_id=p.id AND s.status='available') stock FROM products p LEFT JOIN shop_categories c ON c.id=p.category_id ORDER BY p.id DESC LIMIT 100").all();
  const rows=(q.results||[]).map((p:any)=>`<tr><td>${p.id}</td><td>${webEsc(p.title)}</td><td>${Number(p.price_credits).toFixed(2)}</td><td>${Number(p.cost_credits||0).toFixed(2)}</td><td>${Number(p.stock||0)}</td><td>${p.enabled?'🟢':'⚪'}</td><td><a class="btn" href="/admin-web?tab=products&edit=${p.id}">ویرایش</a></td></tr>`).join('');
  return `${editor}<div class="card" style="margin-top:14px"><div class="actions"><h3 style="margin-left:auto">محصولات</h3><a class="btn good" href="/admin-web?tab=products&new=1">➕ ساخت محصول</a></div>${url.searchParams.get('new')?`<form method="post" action="/admin-web"><input type="hidden" name="action" value="product_create"><div class="row"><div class="field"><label>نام</label><input name="title" required></div><div class="field"><label>دسته</label><select name="category_id">${(cats.results||[]).map((c:any)=>`<option value="${c.id}">${webEsc(c.emoji)} ${webEsc(c.title)}</option>`).join('')}</select></div></div><div class="row"><div class="field"><label>قیمت فروش</label><input type="number" step="0.0001" min="0" name="price_credits" required></div><div class="field"><label>هزینه تمام‌شده</label><input type="number" step="0.0001" min="0" name="cost_credits" value="0"></div></div><div class="field"><label>توضیحات</label><textarea name="description"></textarea></div><button class="btn good">ساخت</button></form>`:''}<table><tr><th>ID</th><th>محصول</th><th>فروش</th><th>هزینه</th><th>استوک</th><th>وضعیت</th><th></th></tr>${rows}</table></div>`;
}
async function adminUsersHtml(env:Env,url:URL){
  const q=(url.searchParams.get('q')||'').trim(); const detail=Number(url.searchParams.get('id')||0); let detailHtml='';
  if(detail){const u:any=await env.DB.prepare('SELECT * FROM users WHERE telegram_id=?').bind(detail).first();if(u){const b=await balance(env,detail);const lg:any=await env.DB.prepare('SELECT * FROM credit_ledger WHERE telegram_id=? ORDER BY id DESC LIMIT 20').bind(detail).all();detailHtml=`<div class="card"><h3>${webEsc(u.first_name||'کاربر')} ${u.username?'@'+webEsc(u.username):''}</h3><p class="muted ltr">Telegram ID: ${u.telegram_id}</p><div class="metric">${b.total.toFixed(2)} Credit</div><form method="post" action="/admin-web" style="margin-top:14px"><input type="hidden" name="action" value="balance_adjust"><input type="hidden" name="telegram_id" value="${u.telegram_id}"><div class="row"><div class="field"><label>مقدار تغییر (+ یا -)</label><input type="number" step="0.0001" name="amount" required></div><div class="field"><label>توضیح</label><input name="note" placeholder="اصلاح موجودی"></div></div><button class="btn primary">ثبت تغییر موجودی</button></form><h4>آخرین گردش‌ها</h4><table><tr><th>مقدار</th><th>نوع</th><th>توضیح</th><th>زمان</th></tr>${(lg.results||[]).map((x:any)=>`<tr><td>${Number(x.amount).toFixed(2)}</td><td>${webEsc(x.kind)}</td><td>${webEsc(x.note||'')}</td><td>${webEsc(x.created_at)}</td></tr>`).join('')}</table></div>`;}}
  let stmt:any;if(q){const like=`%${q.replace(/^@/,'')}%`;stmt=env.DB.prepare("SELECT u.*,(SELECT COALESCE(SUM(amount),0) FROM credit_ledger l WHERE l.telegram_id=u.telegram_id) balance FROM users u WHERE CAST(u.telegram_id AS TEXT) LIKE ? OR username LIKE ? OR first_name LIKE ? ORDER BY u.id DESC LIMIT 100").bind(like,like,like);}else stmt=env.DB.prepare("SELECT u.*,(SELECT COALESCE(SUM(amount),0) FROM credit_ledger l WHERE l.telegram_id=u.telegram_id) balance FROM users u ORDER BY u.id DESC LIMIT 100");const r:any=await stmt.all();
  return `${detailHtml}<div class="card" style="margin-top:14px"><form method="get" action="/admin-web"><input type="hidden" name="tab" value="users"><div class="row"><div><input name="q" value="${webEsc(q)}" placeholder="ID، username یا نام"></div><div><button class="btn">جستجو</button></div></div></form><table><tr><th>ID</th><th>نام</th><th>Username</th><th>موجودی</th><th>عضویت</th><th></th></tr>${(r.results||[]).map((u:any)=>`<tr><td class="ltr">${u.telegram_id}</td><td>${webEsc(u.first_name||'')}</td><td>${u.username?'@'+webEsc(u.username):'—'}</td><td>${Number(u.balance||0).toFixed(2)}</td><td>${u.join_verified?'✅':'—'}</td><td><a class="btn" href="/admin-web?tab=users&id=${u.telegram_id}">باز کردن</a></td></tr>`).join('')}</table></div>`;
}
async function adminOrdersHtml(env:Env){const r:any=await env.DB.prepare("SELECT o.*,p.title FROM orders o JOIN products p ON p.id=o.product_id ORDER BY o.id DESC LIMIT 100").all();return `<div class="card"><h3>آخرین سفارش‌ها</h3><table><tr><th>سفارش</th><th>کاربر</th><th>محصول</th><th>فروش</th><th>هزینه</th><th>سود</th><th>وضعیت</th></tr>${(r.results||[]).map((o:any)=>`<tr><td>${webEsc(o.public_id)}</td><td class="ltr">${o.telegram_id}</td><td>${webEsc(o.title)} × ${o.quantity}</td><td>${Number(o.total_price).toFixed(2)}</td><td>${Number(o.cost_total||0).toFixed(2)}</td><td>${(Number(o.total_price)-Number(o.cost_total||0)).toFixed(2)}</td><td>${webEsc(o.status)}</td></tr>`).join('')}</table></div>`;}
async function adminPaymentsHtml(env:Env,url?:URL){await refreshRates(env);const cfg=await paymentConfig(env);const mode=(await getSetting(env,'ton_rate_mode','auto')).toLowerCase();const auto=await getSetting(env,'ton_usd_rate_auto','0');const upd=await getSetting(env,'ton_usd_rate_updated_at','');const b=await bep20Status(env);const test=String(url?.searchParams.get('test')||'');let diag='';if(['all','bep20','trc20','ton','card','rates'].includes(test))diag=diagnosticsHtml(await paymentDiagnostics(env,test));return `<div class="card"><h3>BEP20 / USDT روی BSC</h3><p>وضعیت: <b>${!b.enabled?'غیرفعال':!b.ready?'تنظیم ناقص':b.testMode?'حالت تست':'فعال واقعی'}</b></p><p>Wallet: <span class="ltr">${webEsc(b.wallet||'—')}</span></p><p>Contract whitelist: <span class="ltr">${BSC_USDT_CONTRACT}</span></p><p>Chain ID: <b>56</b> | Confirmations: <b>${webEsc(await getSetting(env,'confirmations_bep20','5'))}</b></p><p class="muted">Etherscan V2 در اولویت است و اگر در دسترس نباشد Scanner به BSC RPC fallback می‌رود.</p><form method="post" action="/admin-web"><input type="hidden" name="action" value="bep20_mode_toggle"><button class="btn ${b.testMode?'good':'warn'}">${b.testMode?'فعال‌کردن حالت واقعی':'برگشت به حالت تست'}</button></form><form method="post" action="/admin-web" style="margin-top:8px"><input type="hidden" name="action" value="bep20_feature_toggle"><button class="btn">${b.enabled?'غیرفعال‌کردن BEP20':'فعال‌کردن BEP20'}</button></form><div class="actions" style="margin-top:12px"><a class="btn good" href="/admin-web?tab=payments&test=all">🧪 تست همه روش‌ها</a><a class="btn" href="/admin-web?tab=payments&test=bep20">BEP20</a><a class="btn" href="/admin-web?tab=payments&test=trc20">TRC20</a><a class="btn" href="/admin-web?tab=payments&test=ton">TON</a><a class="btn" href="/admin-web?tab=payments&test=card">کارت</a><a class="btn" href="/admin-web?tab=payments&test=rates">Rates</a></div></div><div class="card" style="margin-top:14px"><h3>نرخ TON و پرداخت</h3><p>نرخ موثر فعلی: <b>$${Number(cfg.tonRate||0).toFixed(4)}</b></p><p class="muted">نرخ خودکار ذخیره‌شده: $${Number(auto||0).toFixed(4)} ${upd?`— ${webEsc(upd)}`:''}</p><form method="post" action="/admin-web"><input type="hidden" name="action" value="ton_rate_save"><div class="row"><div class="field"><label>حالت نرخ</label><select name="mode"><option value="auto" ${mode==='auto'?'selected':''}>خودکار (CoinGecko)</option><option value="manual" ${mode==='manual'?'selected':''}>دستی</option></select></div><div class="field"><label>نرخ دستی TON/USD</label><input type="number" step="0.0001" min="0" name="manual_rate" value="${webEsc(await getSetting(env,'ton_usd_rate',env.TON_USD_RATE||''))}"></div></div><button class="btn primary">ذخیره</button></form><form method="post" action="/admin-web" style="margin-top:10px"><input type="hidden" name="action" value="ton_rate_refresh"><button class="btn good">🔄 دریافت فوری نرخ خودکار</button></form><hr style="border-color:#24314e;margin:18px 0"><p>USD/TRY: <b>${(await getRate(env,'USDTRY'))||'—'}</b> | USD/IRR: <b>${(await getRate(env,'USDIRR'))||'—'}</b></p><p>🟡 BEP20: <span class="ltr">${webEsc(cfg.bep20||'غیرفعال')}</span></p><p>🔴 TRC20: <span class="ltr">${webEsc(cfg.trc20||'غیرفعال')}</span></p><p>💎 TON: <span class="ltr">${webEsc(cfg.ton||'غیرفعال')}</span></p><p>🏦 کارت: ${webEsc(cfg.card||'غیرفعال')} — ${webEsc(cfg.cardHolder||'')}</p></div>${diag}`;}

async function adminOperationsHtml(env:Env){const m=await maintenanceOn(env);const features=[['feature_shop','فروشگاه'],['feature_crypto','کریپتو'],['feature_card','کارت'],['feature_referral','Referral'],['feature_support','پشتیبانی'],['feature_broadcast','Broadcast']];let fs='';for(const [k,l] of features)fs+=`<tr><td>${webEsc(l)}</td><td>${await featureEnabled(env,k,true)?'🟢 فعال':'⚪ غیرفعال'}</td><td><form method="post" action="/admin-web"><input type="hidden" name="action" value="feature_toggle"><input type="hidden" name="key" value="${k}"><button class="btn">تغییر</button></form></td></tr>`;return `<div class="card"><h3>عملیات و Feature Flags</h3><p>حالت نگهداری: <b>${m?'🔴 فعال':'🟢 غیرفعال'}</b></p><form method="post" action="/admin-web"><input type="hidden" name="action" value="maintenance_toggle"><button class="btn ${m?'good':'bad'}">${m?'خاموش کردن':'فعال کردن'} نگهداری</button></form><table><tr><th>قابلیت</th><th>وضعیت</th><th></th></tr>${fs}</table></div>`;}
function adminBackupHtml(){return `<div class="card"><h3>Backup / Export</h3><p class="muted">خروجی JSON از داده‌های اصلی. فایل‌ها فقط با Session معتبر ادمین قابل دریافت‌اند.</p><div class="actions"><a class="btn" href="/admin-web/export?type=users">Users</a><a class="btn" href="/admin-web/export?type=orders">Orders</a><a class="btn" href="/admin-web/export?type=ledger">Ledger</a><a class="btn" href="/admin-web/export?type=payments">Payments</a><a class="btn" href="/admin-web/export?type=settings">Settings</a><a class="btn good" href="/admin-web/export?type=all">Full Backup</a></div></div>`;}
async function exportAdminData(env:Env,type:string){const allowed=new Set(['users','orders','ledger','payments','settings','all']);if(!allowed.has(type))type='all';const out:any={exported_at:nowIso(),version:'0.7.4'};const load=async(name:string,sql:string)=>{const r:any=await env.DB.prepare(sql).all();out[name]=r.results||[];};if(type==='users'||type==='all')await load('users','SELECT * FROM users ORDER BY id');if(type==='orders'||type==='all')await load('orders','SELECT * FROM orders ORDER BY id');if(type==='ledger'||type==='all')await load('ledger','SELECT * FROM credit_ledger ORDER BY id');if(type==='payments'||type==='all'){await load('payment_invoices','SELECT * FROM payment_invoices ORDER BY id');await load('payment_events','SELECT * FROM payment_events ORDER BY id');}if(type==='settings'||type==='all')await load('bot_settings','SELECT * FROM bot_settings ORDER BY key');if(type==='all'){await load('products','SELECT * FROM products ORDER BY id');await load('categories','SELECT * FROM shop_categories ORDER BY id');await load('referrals','SELECT * FROM referrals ORDER BY id');await load('support_tickets','SELECT * FROM support_tickets ORDER BY id');await load('admin_logs','SELECT * FROM admin_logs ORDER BY id');await load('risk_blacklist','SELECT * FROM risk_blacklist ORDER BY id');await load('rate_quotes','SELECT * FROM rate_quotes ORDER BY pair');}return out;}

async function handleWebAdmin(req:Request,env:Env,url:URL):Promise<Response|null>{
  if(!url.pathname.startsWith('/admin-web'))return null;
  if(!env.ADMIN_WEB_PASSWORD||!env.ADMIN_SESSION_SECRET)return new Response('ADMIN_WEB_PASSWORD / ADMIN_SESSION_SECRET are not configured.',{status:503});
  if(url.pathname==='/admin-web/export'){const session:any=await validAdminSession(req,env);if(!session)return loginPage();const type=url.searchParams.get('type')||'all';const data=await exportAdminData(env,type);return new Response(JSON.stringify(data,null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="nexora-${type}-${new Date().toISOString().slice(0,10)}.json"`,'cache-control':'no-store'}});}
  if(req.method==='POST'){
    const fd=await req.formData();const action=String(fd.get('action')||'');
    if(action==='login'){
      if(await isLoginBlocked(req,env))return loginPage('تلاش‌های ناموفق زیادی ثبت شده. ۳۰ دقیقه بعد دوباره امتحان کن.');
      const got=await sha256Hex(String(fd.get('password')||'')),expected=await sha256Hex(env.ADMIN_WEB_PASSWORD);
      if(!safeEq(got,expected)){await recordLoginFailure(req,env);return loginPage('رمز اشتباه است.');}
      await clearLoginFailures(req,env);const session=await makeAdminSession(req,env);return new Response(null,{status:303,headers:{location:'/admin-web','set-cookie':`nexora_admin=${encodeURIComponent(session.token)}; Path=/admin-web; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`}});
    }
    const session:any=await validAdminSession(req,env);if(!session)return loginPage();
    if(!safeEq(String(fd.get('csrf')||''),String(session.csrf_token||'')))return new Response('invalid csrf token',{status:403});
    if(action==='logout'){await revokeAdminSession(req,env);return new Response(null,{status:303,headers:{location:'/admin-web','set-cookie':'nexora_admin=; Path=/admin-web; Max-Age=0; HttpOnly; Secure; SameSite=Strict'}});}
    if(action==='product_save'){
      const id=Number(fd.get('id')),price=Number(fd.get('price_credits')),cost=Number(fd.get('cost_credits')),sort=Number(fd.get('sort_order')||100),cat=Number(fd.get('category_id')),enabled=Number(fd.get('enabled'))?1:0;
      const title=String(fd.get('title')||'').trim();if(!id||!title||title.length>200||!Number.isFinite(price)||price<0||price>1e6||!Number.isFinite(cost)||cost<0||cost>1e6||!Number.isInteger(sort)||Math.abs(sort)>1e6||!Number.isInteger(cat)||cat<1)return new Response('invalid product data',{status:400});
      await env.DB.prepare('UPDATE products SET title=?,description=?,price_credits=?,cost_credits=?,warranty_text=?,format_text=?,category_id=?,sort_order=?,enabled=? WHERE id=?').bind(title,String(fd.get('description')||'').slice(0,5000),price,cost,String(fd.get('warranty_text')||'').slice(0,500),String(fd.get('format_text')||'').slice(0,500),cat,sort,enabled,id).run();await logAdmin(env,0,'web_product_save','product',String(id),'web admin');
      return Response.redirect(`${url.origin}/admin-web?tab=products&edit=${id}`,303);
    }
    if(action==='product_create'){
      const title=String(fd.get('title')||'').trim(),price=Number(fd.get('price_credits')),cost=Number(fd.get('cost_credits')||0),cat=Number(fd.get('category_id')||1);if(!title||title.length>200||!Number.isFinite(price)||price<0||price>1e6||!Number.isFinite(cost)||cost<0||cost>1e6||!Number.isInteger(cat)||cat<1)return new Response('invalid product data',{status:400});
      const r=await env.DB.prepare("INSERT INTO products(title,description,price_credits,cost_credits,delivery_type,enabled,sort_order,category_id) VALUES(?,?,?,?, 'stock',1,100,?)").bind(title,String(fd.get('description')||'').slice(0,5000),price,cost,cat).run();await logAdmin(env,0,'web_product_create','product',String(r.meta.last_row_id),'web admin');return Response.redirect(`${url.origin}/admin-web?tab=products&edit=${r.meta.last_row_id}`,303);
    }
    if(action==='balance_adjust'){
      const uid=Number(fd.get('telegram_id')),amount=Number(fd.get('amount'));if(!Number.isSafeInteger(uid)||uid<=0||!Number.isFinite(amount)||amount===0||Math.abs(amount)>1e6)return new Response('invalid adjustment',{status:400});const user:any=await env.DB.prepare('SELECT id FROM users WHERE telegram_id=?').bind(uid).first();if(!user)return new Response('user not found',{status:404});
      await env.DB.prepare("INSERT INTO credit_ledger(telegram_id,amount,kind,ref_type,ref_id,note) VALUES(?,?,'admin_adjustment','web_admin',? ,?)").bind(uid,amount,publicId('A'),String(fd.get('note')||'اصلاح موجودی توسط ادمین').slice(0,500)).run();await logAdmin(env,0,'web_balance_adjust','user',String(uid),`amount=${amount}`);return Response.redirect(`${url.origin}/admin-web?tab=users&id=${uid}`,303);
    }
    if(action==='ton_rate_save'){const mode=String(fd.get('mode')||'auto')==='manual'?'manual':'auto';const manual=Number(fd.get('manual_rate')||0);if(!Number.isFinite(manual)||manual<0||manual>1e6)return new Response('invalid rate',{status:400});await setSetting(env,'ton_rate_mode',mode);await setSetting(env,'ton_usd_rate',String(manual));if(mode==='auto')await refreshTonRate(env,true);await logAdmin(env,0,'web_ton_rate','setting','ton_rate_mode',mode);return Response.redirect(`${url.origin}/admin-web?tab=payments`,303);}
    if(action==='ton_rate_refresh'){await refreshRates(env,true);await logAdmin(env,0,'web_rate_refresh','setting','rates','manual refresh');return Response.redirect(`${url.origin}/admin-web?tab=payments`,303);}
    if(action==='bep20_mode_toggle'){const b=await bep20Status(env);await setSetting(env,'bep20_test_mode',b.testMode?'0':'1');await logAdmin(env,0,'web_bep20_mode','setting','bep20_test_mode',b.testMode?'live':'test');return Response.redirect(`${url.origin}/admin-web?tab=payments`,303);}
    if(action==='bep20_feature_toggle'){const b=await bep20Status(env);await setSetting(env,'feature_bep20',b.enabled?'0':'1');await logAdmin(env,0,'web_bep20_toggle','setting','feature_bep20',b.enabled?'off':'on');return Response.redirect(`${url.origin}/admin-web?tab=payments`,303);}
    if(action==='maintenance_toggle'){await setSetting(env,'maintenance_mode',(await maintenanceOn(env))?'0':'1');return Response.redirect(`${url.origin}/admin-web?tab=operations`,303);}
    if(action==='feature_toggle'){const key=String(fd.get('key')||'');const allowed=new Set(['feature_shop','feature_crypto','feature_card','feature_referral','feature_support','feature_broadcast']);if(!allowed.has(key))return new Response('invalid feature',{status:400});await setSetting(env,key,(await featureEnabled(env,key,true))?'0':'1');return Response.redirect(`${url.origin}/admin-web?tab=operations`,303);}
    return new Response('unknown action',{status:400});
  }
  const session:any=await validAdminSession(req,env);if(!session)return loginPage();
  const tab=url.searchParams.get('tab')||'dashboard';let body='';if(tab==='products')body=await adminProductsHtml(env,url);else if(tab==='users')body=await adminUsersHtml(env,url);else if(tab==='orders')body=await adminOrdersHtml(env);else if(tab==='payments')body=await adminPaymentsHtml(env,url);else if(tab==='operations')body=await adminOperationsHtml(env);else if(tab==='backup')body=adminBackupHtml();else body=await adminDashboardHtml(env);return new Response(webPage('Admin',body,tab,String(session.csrf_token||'')),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
}

function setupWebhookPage(msg=''){return new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Webhook Setup</title><style>body{font-family:system-ui;background:#0b1020;color:#fff;display:grid;place-items:center;min-height:100vh}.box{width:min(92vw,520px);background:#121a2d;padding:24px;border-radius:16px;border:1px solid #263454}input,button{width:100%;box-sizing:border-box;padding:12px;margin-top:10px;border-radius:10px;border:1px solid #314267;background:#0c1427;color:#fff}button{background:#315da8}</style><div class="box"><h2>تنظیم Webhook</h2><p>SETUP_SECRET را وارد کن. Secret داخل URL یا history ذخیره نمی‌شود.</p>${msg?`<p>${webEsc(msg)}</p>`:''}<form method="post" action="/setup-webhook"><input type="password" name="secret" autocomplete="off" required><button>ثبت Webhook</button></form></div></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'}});}

export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const url=new URL(req.url);
    const webAdmin=await handleWebAdmin(req,env,url); if(webAdmin)return webAdmin;
    if(url.pathname==='/health')return j({ok:true});
    if(url.pathname==='/webhook'){
      if(req.method!=='POST')return new Response('method not allowed',{status:405,headers:{allow:'POST'}});
      if(!env.WEBHOOK_SECRET||env.WEBHOOK_SECRET.length<16)return new Response('webhook secret is not configured',{status:503});
      const got=req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';if(!safeEq(got,env.WEBHOOK_SECRET))return new Response('forbidden',{status:403});
      const len=Number(req.headers.get('content-length')||0);if(len>1024*1024)return new Response('payload too large',{status:413});
      let u:Update;try{u=await req.json() as Update;}catch{return new Response('bad request',{status:400});}await handleUpdate(env,u); return j({ok:true});
    }
    if(url.pathname==='/setup-webhook'){
      if(req.method==='GET')return setupWebhookPage();
      if(req.method!=='POST')return new Response('method not allowed',{status:405,headers:{allow:'GET, POST'}});
      if(!env.SETUP_SECRET||env.SETUP_SECRET.length<16)return new Response('SETUP_SECRET is not configured',{status:503});
      if(!env.WEBHOOK_SECRET||env.WEBHOOK_SECRET.length<16)return new Response('WEBHOOK_SECRET is not configured',{status:503});
      // Do not gate webhook setup on Origin/Sec-Fetch-Site. With custom domains,
      // routes and reverse proxies those headers can legitimately differ. This
      // endpoint is protected by a high-entropy SETUP_SECRET supplied only in the
      // POST body, so a cross-site request without that secret cannot configure it.
      const ct=req.headers.get('content-type')||'';let supplied='';if(ct.includes('application/json')){try{supplied=String((await req.json() as any)?.secret||'');}catch{}}else{try{supplied=String((await req.formData()).get('secret')||'');}catch{}}
      const a=await sha256Hex(supplied),b=await sha256Hex(env.SETUP_SECRET);if(!safeEq(a,b))return setupWebhookPage('Secret صحیح نیست.');
      let base:URL;try{base=new URL(env.PUBLIC_BASE_URL);}catch{return new Response('PUBLIC_BASE_URL is invalid',{status:500});}if(base.protocol!=='https:'||/YOUR-|example/i.test(base.hostname))return new Response('PUBLIC_BASE_URL must be a real HTTPS address',{status:500});
      const target=`${base.origin}${base.pathname.replace(/\/$/,'')}/webhook`; const body:any={url:target,drop_pending_updates:false,secret_token:env.WEBHOOK_SECRET}; const r=await tg(env,'setWebhook',body); return j(r,r.ok?200:502);
    }
    return new Response('Nexora Commerce Bot Worker',{headers:{'cache-control':'no-store'}});
  },
  async scheduled(_controller:ScheduledController,env:Env,ctx:ExecutionContext){
    ctx.waitUntil((async()=>{
      await env.DB.batch([
        env.DB.prepare("UPDATE payment_invoices SET status='expired' WHERE status IN ('pending','awaiting_receipt') AND datetime(expires_at)<=datetime('now')"),
        env.DB.prepare("DELETE FROM admin_sessions WHERE datetime(expires_at)<=datetime('now')"),
        env.DB.prepare("DELETE FROM admin_login_attempts WHERE datetime(updated_at)<=datetime('now','-2 days')")
      ]);
      await migratePlainStock(env); await refreshRates(env); await scanPendingCrypto(env); await processBroadcasts(env);
    })());
  }
};
