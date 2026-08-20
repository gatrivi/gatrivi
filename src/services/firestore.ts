import {getApps,initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore,collection,getDocs,query,where,writeBatch,doc} from 'firebase/firestore';
import type {CrmData} from '../types';

const names=['contacts','stages','deals','tasks','messages','proposals'] as const;
function app(){
  return getApps()[0]??initializeApp({
    apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
    projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId:import.meta.env.VITE_FIREBASE_APP_ID,
  });
}
async function db(){
  const firebaseApp=app();
  const auth=getAuth(firebaseApp);
  await auth.authStateReady();
  if(!auth.currentUser)throw new Error('Firebase Auth no está iniciada.');
  return getFirestore(firebaseApp);
}
export const firestoreRepository={
  async load(tenant:string):Promise<CrmData>{
    const store=await db();
    const result=await Promise.all(names.map(async name=>{
      const snap=await getDocs(query(collection(store,name),where('tenantId','==',tenant)));
      return snap.docs.map(item=>({id:item.id,...item.data()}));
    }));
    return {
      contacts:result[0] as CrmData['contacts'],
      stages:result[1] as CrmData['stages'],
      deals:result[2] as CrmData['deals'],
      tasks:result[3] as CrmData['tasks'],
      messages:result[4] as CrmData['messages'],
      proposals:result[5] as CrmData['proposals'],
    };
  },
  async save(_tenant:string,data:CrmData){
    const store=await db();
    const batch=writeBatch(store);
    for(const name of names)for(const item of data[name])batch.set(doc(store,name,item.id),item);
    await batch.commit();
  }
};
