import type { CrmData } from '../types';

const key=(tenant:string)=>`crm-pyme:${tenant}`;
const colors=['#2563eb','#8b5cf6','#f59e0b','#10b981','#ef4444','#64748b'];
const salesStages=['Nuevo','Contactado','Propuesta','Ganado','Perdido'];
const jobStages=['Descubierto','Aplicado','Screening','Entrevista','Oferta','Rechazado'];

export const defaultStages=(tenant='demo')=>(tenant==='jobs'?jobStages:salesStages).map((name,i)=>({id:`stage-${i+1}`,tenantId:tenant,name,order:i,color:colors[i]}));

export function seed(tenant='demo'):CrmData {
  const stages=defaultStages(tenant);
  if(tenant==='jobs')return {contacts:[],stages,deals:[],tasks:[]};

  const now=new Date().toISOString();
  const contacts=['Ana García','Bruno López','Carla Méndez','Diego Ruiz','Estudio Norte'].map((name,i)=>({id:`contact-${i+1}`,tenantId:tenant,name,phone:`+54 341 555-${100+i}`,email:`${name.toLowerCase().replaceAll(' ','-')}@ejemplo.com`,company:i===4?'Estudio Norte':'Pyme '+(i+1),notes:'Contacto de demostración.',createdAt:now}));
  const deals=[['Nuevo sitio web',0,850000],['Renovación anual',1,420000],['Implementación CRM',2,1250000],['Servicio mensual',3,280000],['Propuesta comercial',2,690000]].map((d,i)=>({id:`deal-${i+1}`,tenantId:tenant,contactId:contacts[i].id,title:d[0] as string,stageId:stages[d[1] as number].id,value:d[2] as number,currency:'ARS',createdAt:now,updatedAt:now}));
  const tasks=['Llamar a Ana','Enviar propuesta a Bruno','Revisar contrato','Preparar reunión'].map((title,i)=>({id:`task-${i+1}`,tenantId:tenant,contactId:contacts[i].id,dealId:deals[i]?.id,title,dueDate:new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,10),done:i===3}));
  return {contacts,stages,deals,tasks};
}

export function load(tenant:string):CrmData {
  try{
    const raw=localStorage.getItem(key(tenant));
    if(raw)return JSON.parse(raw) as CrmData;
  }catch(error){console.error('No se pudo leer el CRM local',error);}
  const data=seed(tenant);
  try{save(tenant,data)}catch(error){console.error('No se pudo inicializar el CRM local',error)}
  return data;
}

export function save(tenant:string,data:CrmData){localStorage.setItem(key(tenant),JSON.stringify(data));}

type JobImport={sourceId:string;company:string;title:string;url?:string;status?:string};
const stableKey=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'unknown';
const stageForStatus=(status='')=>({
  sourced:'Descubierto',ranked:'Descubierto',apply_today:'Descubierto',
  applied:'Aplicado',screening:'Screening',interview:'Entrevista',offer:'Oferta',
  rejected:'Rechazado',skipped:'Rechazado'
}[status.toLowerCase()]??'Descubierto');

export function importJobApplication(input:JobImport):CrmData {
  const tenant='jobs';
  const now=new Date().toISOString();
  const data=load(tenant);
  const stages=data.stages.length?data.stages:defaultStages(tenant);
  const stageName=stageForStatus(input.status);
  const stageId=stages.find(stage=>stage.name===stageName)?.id??stages[0].id;
  const sourceKey=stableKey(input.sourceId||`${input.company}-${input.title}`);
  const company=input.company.trim()||'Empresa sin nombre';
  const title=input.title.trim()||'Aplicación sin título';
  const contactId=`company-${stableKey(company)}`;
  const dealId=`job-${sourceKey}`;
  const notes=['Empresa importada desde Catresumaker.',input.url?`Vacante: ${input.url}`:''].filter(Boolean).join('\n');

  const contacts=data.contacts.some(contact=>contact.id===contactId)
    ? data.contacts.map(contact=>contact.id===contactId?{...contact,name:company,company,notes:notes||contact.notes}:contact)
    : [...data.contacts,{id:contactId,tenantId:tenant,name:company,phone:'',email:'',company,notes,createdAt:now}];

  const existing=data.deals.find(deal=>deal.id===dealId);
  const deal={id:dealId,tenantId:tenant,contactId,title,stageId,value:0,currency:'ARS',createdAt:existing?.createdAt??now,updatedAt:now};
  const deals=existing?data.deals.map(item=>item.id===dealId?deal:item):[...data.deals,deal];

  const followupId=`followup-${sourceKey}`;
  let tasks=data.tasks;
  if(stageName==='Aplicado'&&!tasks.some(task=>task.id===followupId)){
    tasks=[...tasks,{id:followupId,tenantId:tenant,contactId,dealId,title:`Follow-up: ${company} — ${title}`,dueDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),done:false}];
  }
  if(stageName==='Rechazado')tasks=tasks.map(task=>task.id===followupId?{...task,done:true}:task);

  const next={contacts,stages,deals,tasks};
  save(tenant,next);
  return next;
}
