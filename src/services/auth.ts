export type SessionUser={username:string;name:string;tenant:string};

const SESSION_KEY='crm-session';
const testUsers:Record<string,SessionUser>={
  gaston:{username:'gaston',name:'Gastón',tenant:'jobs'},
  fausto:{username:'fausto',name:'Fausto',tenant:'gatrivi'},
};

export async function sha256(value:string):Promise<string>{
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function authenticate(username:string,password:string):Promise<SessionUser|null>{
  const normalized=username.trim().toLowerCase();
  const testUser=testUsers[normalized];
  if(testUser&&password==='hlpc') return testUser;

  const userHash=import.meta.env.VITE_ADMIN_USERNAME_HASH as string|undefined;
  const passHash=import.meta.env.VITE_ADMIN_PASSWORD_HASH as string|undefined;
  if(userHash&&passHash&&await sha256(normalized)===userHash&&await sha256(password)===passHash){
    return {username:normalized,name:username.trim()||'Admin',tenant:(import.meta.env.VITE_TENANT_ID as string|undefined)||'gatrivi'};
  }
  return null;
}

export function startSession(user:SessionUser){localStorage.setItem(SESSION_KEY,JSON.stringify(user));}
export function getSession():SessionUser|null{
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    const user=JSON.parse(raw) as SessionUser;
    return user?.username&&user?.tenant?user:null;
  }catch{return null;}
}
export const isAuthenticated=()=>Boolean(getSession());
export const signOut=()=>localStorage.removeItem(SESSION_KEY);
