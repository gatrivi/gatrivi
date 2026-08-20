import {deleteApp,getApps,initializeApp} from 'firebase/app';
import {createUserWithEmailAndPassword,getAuth,signInWithEmailAndPassword,signOut as firebaseSignOut} from 'firebase/auth';
import {collection,doc,getDoc,getDocs,getFirestore,query,setDoc,where} from 'firebase/firestore';

export type UserRole='member'|'admin';
export type WorkspaceUser={uid?:string;username:string;name:string;role:UserRole;tenants:string[];createdAt?:string};
export type SessionUser=WorkspaceUser&{tenant:string};

const SESSION_KEY='crm-session';
const PIMU_HASH='3beff40db6d3c23685d1de6cf340b2cac550504f04f76280c86a5ee95c03dcd4';
const HLPC_HASH='8e8757ee43f6922a8566548cf34268fc611b1cd3c4fd70de8b4415b0c49112a9';

const bootstrapUsers:Record<string,WorkspaceUser&{passwordHash:string;defaultTenant:string}>={
  gaston:{username:'gaston',name:'Gastón',role:'member',tenants:['gatrivi','personal','jobs'],defaultTenant:'gatrivi',passwordHash:PIMU_HASH},
  pau:{username:'pau',name:'Pau',role:'member',tenants:['personal'],defaultTenant:'personal',passwordHash:PIMU_HASH},
  rodri:{username:'rodri',name:'Rodri',role:'member',tenants:['personal'],defaultTenant:'personal',passwordHash:PIMU_HASH},
  faus:{username:'faus',name:'Faus',role:'admin',tenants:['gatrivi'],defaultTenant:'gatrivi',passwordHash:HLPC_HASH},
};

const firebaseConfig=()=>({
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY as string|undefined,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID as string|undefined,
  appId:import.meta.env.VITE_FIREBASE_APP_ID as string|undefined,
});
const hasFirebaseConfig=()=>Boolean(firebaseConfig().apiKey&&firebaseConfig().projectId&&firebaseConfig().appId);
const mainApp=()=>getApps()[0]??initializeApp(firebaseConfig());
const normalized=(value:string)=>value.trim().toLowerCase();
const emailFor=(username:string)=>`${username}@users.gatrivi.local`;
const toSession=(user:WorkspaceUser,preferredTenant?:string):SessionUser=>{
  const fallback=bootstrapUsers[user.username]?.defaultTenant??user.tenants[0]??'gatrivi';
  const tenant=preferredTenant&&user.tenants.includes(preferredTenant)?preferredTenant:fallback;
  return {...user,tenant};
};

export async function sha256(value:string):Promise<string>{
  const bytes=new TextEncoder().encode(value);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function passwordForFirebase(password:string){return sha256(`gatrivi:${password}`)}
async function validBootstrapPassword(username:string,password:string){
  const user=bootstrapUsers[username];
  return Boolean(user&&await sha256(password)===user.passwordHash);
}
function profileFromData(uid:string,data:Record<string,unknown>):WorkspaceUser|null{
  const username=typeof data.username==='string'?normalized(data.username):'';
  const name=typeof data.name==='string'?data.name.trim():'';
  const role=data.role==='admin'?'admin':'member';
  const tenants=Array.isArray(data.tenants)?data.tenants.filter((item):item is string=>typeof item==='string'):[];
  if(!username||!name||!tenants.length)return null;
  return {uid,username,name,role,tenants,createdAt:typeof data.createdAt==='string'?data.createdAt:undefined};
}

export async function authenticate(username:string,password:string):Promise<SessionUser|null>{
  const userName=normalized(username);
  if(!userName||!password)return null;
  const bootstrapValid=await validBootstrapPassword(userName,password);
  const bootstrap=bootstrapUsers[userName];

  if(!hasFirebaseConfig()){
    return bootstrapValid&&bootstrap?toSession(bootstrap,getSession()?.tenant):null;
  }

  try{
    const app=mainApp();
    const auth=getAuth(app);
    const firebasePassword=await passwordForFirebase(password);
    let credential;
    try{
      credential=await signInWithEmailAndPassword(auth,emailFor(userName),firebasePassword);
    }catch(error){
      if(!bootstrapValid||!bootstrap)throw error;
      credential=await createUserWithEmailAndPassword(auth,emailFor(userName),firebasePassword);
    }

    const store=getFirestore(app);
    const profileRef=doc(store,'users',credential.user.uid);
    const snapshot=await getDoc(profileRef);
    let profile=snapshot.exists()?profileFromData(credential.user.uid,snapshot.data() as Record<string,unknown>):null;
    if(!profile){
      if(!bootstrapValid||!bootstrap)return null;
      profile={uid:credential.user.uid,username:bootstrap.username,name:bootstrap.name,role:bootstrap.role,tenants:bootstrap.tenants,createdAt:new Date().toISOString()};
      await setDoc(profileRef,profile);
    }
    return toSession(profile,getSession()?.tenant);
  }catch(error){
    console.error('Firebase Auth no disponible; usando credencial local bootstrap.',error);
    return bootstrapValid&&bootstrap?toSession(bootstrap,getSession()?.tenant):null;
  }
}

export async function listWorkspaceUsers(tenant:string):Promise<WorkspaceUser[]>{
  const known=Object.values(bootstrapUsers)
    .filter(user=>user.tenants.includes(tenant))
    .map(({passwordHash:_passwordHash,defaultTenant:_defaultTenant,...user})=>user);
  if(!hasFirebaseConfig())return known;

  try{
    const app=mainApp();
    const auth=getAuth(app);
    await auth.authStateReady();
    if(!auth.currentUser)return known;
    const snap=await getDocs(query(collection(getFirestore(app),'users'),where('tenants','array-contains',tenant)));
    const remote=snap.docs
      .map(item=>profileFromData(item.id,item.data() as Record<string,unknown>))
      .filter((item):item is WorkspaceUser=>Boolean(item));
    const merged=new Map<string,WorkspaceUser>();
    [...known,...remote].forEach(user=>merged.set(user.username,user));
    return [...merged.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }catch(error){
    console.error('No se pudo cargar el equipo remoto.',error);
    return known;
  }
}

export async function createUser(input:{username:string;name:string;password:string;tenants:string[]}):Promise<WorkspaceUser>{
  const session=getSession();
  if(!session||session.username!=='faus')throw new Error('Solo Faus puede crear usuarios.');
  if(!hasFirebaseConfig())throw new Error('Firebase debe estar configurado para crear usuarios compartidos.');

  const username=normalized(input.username);
  const name=input.name.trim();
  const tenants=[...new Set(input.tenants.filter(tenant=>tenant==='gatrivi'||tenant==='personal'))];
  if(!/^[a-z0-9._-]{2,32}$/.test(username))throw new Error('Usuario inválido. Usá letras, números, punto, guion o guion bajo.');
  if(!name)throw new Error('Falta el nombre.');
  if(input.password.length<4)throw new Error('La contraseña debe tener al menos 4 caracteres.');
  if(!tenants.length)throw new Error('Elegí al menos un espacio.');

  const app=mainApp();
  const auth=getAuth(app);
  await auth.authStateReady();
  if(!auth.currentUser)throw new Error('Volvé a iniciar sesión para crear usuarios.');

  const secondary=initializeApp(firebaseConfig(),`user-creator-${crypto.randomUUID()}`);
  try{
    const secondaryAuth=getAuth(secondary);
    const credential=await createUserWithEmailAndPassword(secondaryAuth,emailFor(username),await passwordForFirebase(input.password));
    const profile:WorkspaceUser={uid:credential.user.uid,username,name,role:'member',tenants,createdAt:new Date().toISOString()};
    await setDoc(doc(getFirestore(app),'users',credential.user.uid),profile);
    await firebaseSignOut(secondaryAuth);
    return profile;
  }finally{
    await deleteApp(secondary);
  }
}

export function startSession(user:SessionUser){localStorage.setItem(SESSION_KEY,JSON.stringify(user))}
export function getSession():SessionUser|null{
  try{
    const raw=localStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    const user=JSON.parse(raw) as SessionUser;
    if(!user?.username||!Array.isArray(user.tenants)||!user.tenants.length)return null;
    const tenant=user.tenants.includes(user.tenant)?user.tenant:user.tenants[0];
    return {...user,tenant};
  }catch{return null}
}
export function getAvailableWorkspaces(){return getSession()?.tenants??[]}
export function switchWorkspace(tenant:string):SessionUser|null{
  const user=getSession();
  if(!user||!user.tenants.includes(tenant))return null;
  const next={...user,tenant};
  startSession(next);
  return next;
}
export const isAuthenticated=()=>Boolean(getSession());
export function signOut(){
  localStorage.removeItem(SESSION_KEY);
  if(hasFirebaseConfig())firebaseSignOut(getAuth(mainApp())).catch(error=>console.error('No se pudo cerrar Firebase Auth.',error));
}
