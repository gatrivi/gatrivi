import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {CrmData,Deal,ProspectMeta,Task} from '../types';
import {getRepository} from '../services/repository';

type LeadInput={name:string;company:string;phone:string;email:string;dealTitle:string;value:number};
type ProspectInput={name:string;company:string;phone:string;email:string;value:number;prospect:Omit<ProspectMeta,'createdAt'>};
type TaskInput={title:string;dueDate:string;contactId?:string};
type Ctx=CrmData & {
  tenant:string;
  persistenceError:string;
  moveDeal:(id:string,stageId:string)=>void;
  toggleTask:(id:string)=>void;
  updateStage:(id:string,name:string)=>void;
  addLead:(input:LeadInput)=>void;
  addProspect:(input:ProspectInput)=>void;
  addTask:(input:TaskInput)=>void;
  setProspectStage:(contactId:string,stageName:string)=>void;
  markProspectContacted:(contactId:string)=>void;
};

const Crm=createContext<Ctx|null>(null);
const id=(prefix:string)=>`${prefix}-${globalThis.crypto?.randomUUID?.()??Date.now().toString(36)}`;

export function CrmProvider({tenant,children}:{tenant:string;children:ReactNode}){
  const repository=useMemo(()=>getRepository(tenant),[tenant]);
  const [data,setData]=useState<CrmData|null>(null);
  const [persistenceError,setPersistenceError]=useState('');

  useEffect(()=>{
    let active=true;
    setData(null);
    setPersistenceError('');
    repository.load(tenant)
      .then(next=>{if(active)setData(next)})
      .catch(error=>{
        console.error(error);
        if(active)setPersistenceError('No pudimos cargar los datos. Recargá la página para reintentar.');
      });
    return()=>{active=false};
  },[repository,tenant]);

  useEffect(()=>{
    if(!data)return;
    repository.save(tenant,data)
      .then(()=>setPersistenceError(''))
      .catch(error=>{
        console.error(error);
        setPersistenceError('Los últimos cambios podrían no haberse guardado.');
      });
  },[data,repository,tenant]);

  const value=useMemo<Ctx|null>(()=>{
    if(!data)return null;
    return {
      ...data,
      tenant,
      persistenceError,
      moveDeal:(dealId,stageId)=>setData(current=>current?({...current,deals:current.deals.map(deal=>deal.id===dealId?{...deal,stageId,updatedAt:new Date().toISOString()}:deal)}):current),
      toggleTask:(taskId)=>setData(current=>current?({...current,tasks:current.tasks.map(task=>task.id===taskId?{...task,done:!task.done}:task)}):current),
      updateStage:(stageId,name)=>setData(current=>current?({...current,stages:current.stages.map(stage=>stage.id===stageId?{...stage,name}:stage)}):current),
      addLead:input=>setData(current=>{
        if(!current)return current;
        const now=new Date().toISOString();
        const contactId=id('contact');
        const dealId=id('deal');
        const stageId=current.stages[0]?.id;
        if(!stageId)return current;
        return {
          ...current,
          contacts:[...current.contacts,{id:contactId,tenantId:tenant,name:input.name.trim(),phone:input.phone.trim(),email:input.email.trim(),company:input.company.trim(),notes:'Lead cargado desde alta rápida.',createdAt:now}],
          deals:[...current.deals,{id:dealId,tenantId:tenant,contactId,title:input.dealTitle.trim(),stageId,value:input.value,currency:'ARS',createdAt:now,updatedAt:now}],
        };
      }),
      addProspect:input=>setData(current=>{
        if(!current)return current;
        const now=new Date().toISOString();
        const contactId=id('contact');
        const dealId=id('deal');
        const taskId=id('task');
        const stageId=current.stages.find(stage=>stage.name==='Nuevo')?.id??current.stages[0]?.id;
        if(!stageId)return current;
        const company=input.company.trim()||input.name.trim();
        const contactName=input.name.trim()||company;
        return {
          ...current,
          contacts:[...current.contacts,{
            id:contactId,
            tenantId:tenant,
            name:contactName,
            phone:input.phone.trim(),
            email:input.email.trim(),
            company,
            notes:`Prospecto TMM · fit ${input.prospect.score}/100.`,
            createdAt:now,
            prospect:{...input.prospect,createdAt:now},
          }],
          deals:[...current.deals,{
            id:dealId,
            tenantId:tenant,
            contactId,
            title:`Sitio / tienda para ${company}`,
            stageId,
            value:input.value,
            currency:'ARS',
            createdAt:now,
            updatedAt:now,
          }],
          tasks:[...current.tasks,{
            id:taskId,
            tenantId:tenant,
            contactId,
            dealId,
            title:`Contactar a ${company}`,
            dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),
            done:false,
          }],
        };
      }),
      addTask:input=>setData(current=>current?({...current,tasks:[...current.tasks,{id:id('task'),tenantId:tenant,contactId:input.contactId||undefined,title:input.title.trim(),dueDate:input.dueDate,done:false}]}):current),
      setProspectStage:(contactId,stageName)=>setData(current=>{
        if(!current)return current;
        const stage=current.stages.find(item=>item.name===stageName);
        if(!stage)return current;
        const now=new Date().toISOString();
        return {...current,deals:current.deals.map(deal=>deal.contactId===contactId?{...deal,stageId:stage.id,updatedAt:now}:deal)};
      }),
      markProspectContacted:contactId=>setData(current=>{
        if(!current)return current;
        const now=new Date().toISOString();
        const contact=current.contacts.find(item=>item.id===contactId);
        if(!contact?.prospect)return current;
        const deal=current.deals.find(item=>item.contactId===contactId);
        const contactedStage=current.stages.find(stage=>stage.name==='Contactado');
        const company=contact.company||contact.name;
        let tasks=current.tasks.map(task=>task.contactId===contactId&&!task.done&&task.title.toLowerCase().startsWith('contactar')?{...task,done:true}:task);
        const hasOpenFollowup=tasks.some(task=>task.contactId===contactId&&!task.done&&task.title.toLowerCase().includes('follow-up'));
        if(!hasOpenFollowup){
          tasks=[...tasks,{
            id:id('task'),
            tenantId:tenant,
            contactId,
            dealId:deal?.id,
            title:`Follow-up: ${company}`,
            dueDate:new Date(Date.now()+2*86400000).toISOString().slice(0,10),
            done:false,
          }];
        }
        return {
          ...current,
          contacts:current.contacts.map(item=>item.id===contactId&&item.prospect?{...item,prospect:{...item.prospect,lastContactedAt:now}}:item),
          deals:current.deals.map(item=>item.contactId===contactId&&contactedStage?{...item,stageId:contactedStage.id,updatedAt:now}:item),
          tasks,
        };
      }),
    };
  },[data,persistenceError,tenant]);

  if(!value)return <div className="loading">{persistenceError||'Cargando tu espacio...'}</div>;
  return <Crm.Provider value={value}>{children}</Crm.Provider>;
}

export const useCrm=()=>{const context=useContext(Crm);if(!context)throw Error('CrmProvider missing');return context};
export type {Deal,Task};
