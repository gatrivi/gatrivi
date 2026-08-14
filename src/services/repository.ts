import type { CrmData } from '../types';
import {load,save} from './storage';
import {firestoreRepository} from './firestore';

export interface CrmRepository { load(tenant:string):Promise<CrmData>; save(tenant:string,data:CrmData):Promise<void> }
export const localRepository:CrmRepository={load:async tenant=>load(tenant),save:async(tenant,data)=>save(tenant,data)};
export const hasFirebaseConfig=()=>Boolean(import.meta.env.VITE_FIREBASE_API_KEY&&import.meta.env.VITE_FIREBASE_PROJECT_ID&&import.meta.env.VITE_FIREBASE_APP_ID);

const resilientFirestoreRepository:CrmRepository={
  async load(tenant){
    try{const remote=await firestoreRepository.load(tenant);return remote.stages.length?remote:localRepository.load(tenant)}
    catch(error){console.error('Firestore no disponible; usando datos locales.',error);return localRepository.load(tenant)}
  },
  async save(tenant,data){
    try{await firestoreRepository.save(tenant,data)}
    catch(error){console.error('Firestore no disponible; guardando localmente.',error);await localRepository.save(tenant,data)}
  }
};

export const getRepository=():CrmRepository=>hasFirebaseConfig()?resilientFirestoreRepository:localRepository;
