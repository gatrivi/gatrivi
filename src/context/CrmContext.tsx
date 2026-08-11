import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {CrmData,Deal,Task} from '../types';
import {getRepository} from '../services/repository';

type Ctx=CrmData & {tenant:string;moveDeal:(id:string,stageId:string)=>void;toggleTask:(id:string)=>void;updateStage:(id:string,name:string)=>void};
const Crm=createContext<Ctx|null>(null);

export function CrmProvider({tenant,children}:{tenant:string;children:ReactNode}){
 const [data,setData]=useState<CrmData|null>(null);
 useEffect(()=>{getRepository().load(tenant).then(setData)},[tenant]);
 useEffect(()=>{if(data)getRepository().save(tenant,data)},[tenant,data]);
 if(!data)return <div className="loading">Cargando tu espacio...</div>;
 const value=useMemo(()=>({...data,tenant,moveDeal:(id:string,stageId:string)=>setData(current=>current?({...current,deals:current.deals.map(x=>x.id===id?{...x,stageId,updatedAt:new Date().toISOString()}:x)}):current),toggleTask:(id:string)=>setData(current=>current?({...current,tasks:current.tasks.map(x=>x.id===id?{...x,done:!x.done}:x)}):current),updateStage:(id:string,name:string)=>setData(current=>current?({...current,stages:current.stages.map(x=>x.id===id?{...x,name}:x)}):current)}),[data,tenant]);
 return <Crm.Provider value={value}>{children}</Crm.Provider>;
}
export const useCrm=()=>{const c=useContext(Crm);if(!c)throw Error('CrmProvider missing');return c}; export type {Deal,Task};