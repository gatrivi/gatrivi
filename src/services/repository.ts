import type { CrmData } from '../types'; import {load,save} from './storage'; import {firestoreRepository} from './firestore';
export interface CrmRepository { load(tenant:string):Promise<CrmData>; save(tenant:string,data:CrmData):Promise<void> }
export const localRepository:CrmRepository={load:async tenant=>load(tenant),save:async(tenant,data)=>save(tenant,data)};
export const hasFirebaseConfig=()=>Boolean(import.meta.env.VITE_FIREBASE_API_KEY&&import.meta.env.VITE_FIREBASE_PROJECT_ID&&import.meta.env.VITE_FIREBASE_APP_ID);

export const getRepository=():CrmRepository=>hasFirebaseConfig()?firestoreRepository:localRepository;
