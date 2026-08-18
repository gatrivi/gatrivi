import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {CrmData,Deal,ProspectMeta,Task} from '../types';
import {getRepository} from '../services/repository';
import {stageIdByName} from '../services/outboundFunnel';
import {getSession} from '../services/auth';

type LeadInput={name:string;company:string;phone:string;email:string;dealTitle:string;value:number};
type ProspectInput={name:string;company:string;phone:string;email:string;value:number;prospect:Omit<ProspectMeta,'createdAt'>};
type TaskInput={title:string;dueDate:string;contactId?:string;assigneeUsername?:string};
type MessageInput={toUsername:string;body:string};
type ProposalInput={recipientUsername:string;title:string;body:string;taskId?:string};
type Ctx=CrmData & {
  tenant:string;
  persistenceError:string;
  moveDeal:(id:string,stageId:string)=>void;
  toggleTask:(id:string)=>void;
  updateStage:(id:string,name:string)=>void;
  addLead:(input:LeadInput)=>void;
  addProspect:(input:ProspectInput)=>void;
  addTask:(input:TaskInput)=>void;
  addMessage:(input:MessageInput)=>void;
  addProposal:(input:ProposalInput)=>void;
  decideProposal:(id:string,status:'accepted'|'rejected')=>void;
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
      .then(next=>{if(active)setData({...next,messages:next.messages??[],proposals:next.proposals??[]})})
      .catch(error=>{
        console.error(error);
        if(active)setPersistenceError('No pudimos cargar los datos. Recargá la página para reintentar.');
      });
    return()=>{active=false};
  },[repository,tenant]);

  useEffect(()=>{
    if(!data||tenant==='jobs'||tenant==='personal'||data.contacts.some(contact=>contact.prospect))return;
    if(window.location.pathname===`/t/${tenant}/dashboard`){
      window.location.replace(`/t/${tenant}/prospects`);
    }
  },[data,tenant]);

  useEffect(()=>{
    if(!data)return;
    repository.save(tenant,data)
      .then(()=>setPersistenceError(''))
      .catch(error=>{
        console.error(error);
        setPersistenceError('Los últimos cambios podrían no haberse guardado.');
      });
  },[data,repository,tenant]);

  useEffect(()=>{
    if(tenant==='jobs')return;
    let active=true;
    const refresh=()=>repository.load(tenant).then(next=>{
      if(!active)return;
      const normalized={...next,messages:next.messages??[],proposals:next.proposals??[]};
      setData(current=>current&&JSON.stringify(current)===JSON.stringify(normalized)?current:normalized);
    }).catch(error=>console.error('No se pudo refrescar el espacio compartido.',error));
    const timer=window.setInterval(refresh,8000);
    window.addEventListener('focus',refresh);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh)};
  },[repository,tenant]);

  const value=useMemo<Ctx|null>(()=>{
    if(!data)return null;
    const actor=getSession()?.username??'unknown';
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
        const stageId=stageIdByName(current.stages,'Encontrado')??current.stages[0]?.id;
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
        const targetStage=input.prospect.score>=55?'Demo lista':'Encontrado';
        const stageId=stageIdByName(current.stages,targetStage)??current.stages[0]?.id;
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
            title:input.prospect.score>=55?`Enviar demo a ${company}`:`Revisar fit de ${company}`,
            dueDate:new Date().toISOString().slice(0,10),
            done:false,
            assigneeUsername:actor,
            createdBy:actor,
            createdAt:now,
          }],
        };
      }),
      addTask:input=>setData(current=>current?({...current,tasks:[...current.tasks,{id:id('task'),tenantId:tenant,contactId:input.contactId||undefined,title:input.title.trim(),dueDate:input.dueDate,done:false,assigneeUsername:input.assigneeUsername||actor,createdBy:actor,createdAt:new Date().toISOString()}]}):current),
      addMessage:input=>setData(current=>current?({...current,messages:[...current.messages,{id:id('message'),tenantId:tenant,fromUsername:actor,toUsername:input.toUsername,body:input.body.trim(),createdAt:new Date().toISOString()}]}):current),
      addProposal:input=>setData(current=>current?({...current,proposals:[...current.proposals,{id:id('proposal'),tenantId:tenant,createdBy:actor,recipientUsername:input.recipientUsername,title:input.title.trim(),body:input.body.trim(),taskId:input.taskId||undefined,status:'pending',createdAt:new Date().toISOString()}]}):current),
      decideProposal:(proposalId,status)=>setData(current=>current?({...current,proposals:current.proposals.map(proposal=>proposal.id===proposalId?{...proposal,status,decidedAt:new Date().toISOString(),decidedBy:actor}:proposal)}):current),
    };
  },[data,persistenceError,tenant]);

  if(!value)return <div className="loading">{persistenceError||'Cargando tu espacio...'}</div>;
  return <Crm.Provider value={value}>{children}</Crm.Provider>;
}

export const useCrm=()=>{const context=useContext(Crm);if(!context)throw Error('CrmProvider missing');return context};
export type {Deal,Task};
