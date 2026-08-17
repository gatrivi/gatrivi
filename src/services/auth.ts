export type SessionUser={username:string;name:string;tenant:string};

const SESSION_KEY='crm-session';
const testUsers:Record<string,SessionUser>={
  gaston:{username:'gaston',name:'Gastón',tenant:'gatrivi'},
  fausto:{username:'fausto',name:'Fausto',tenant:'gatrivi'},
};
const allowedTenants:Record<string,string[]>={
  gaston:['gatrivi','jobs'],
  fausto:['gatrivi'],
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
    if(!user?.username)return null;
    const normalized=user.username.toLowerCase();
    const canonical=testUsers[normalized];
    if(canonical){
      const tenants=allowedTenants[normalized]??[canonical.tenant];
      const tenant=tenants.includes(user.tenant)?user.tenant:canonical.tenant;
      const resolved={...canonical,tenant};
      if(user.tenant!==resolved.tenant||user.name!==resolved.name)startSession(resolved);
      return resolved;
    }
    return user.tenant?user:null;
  }catch{return null;}
}
export function getAvailableWorkspaces(){
  const user=getSession();
  return user?(allowedTenants[user.username.toLowerCase()]??[user.tenant]):[];
}
export function switchWorkspace(tenant:string):SessionUser|null{
  const user=getSession();
  if(!user)return null;
  const allowed=allowedTenants[user.username.toLowerCase()];
  if(allowed&&!allowed.includes(tenant))return null;
  const next={...user,tenant};
  startSession(next);
  return next;
}
export const isAuthenticated=()=>Boolean(getSession());
export const signOut=()=>localStorage.removeItem(SESSION_KEY);
