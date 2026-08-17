import type {CrmData,Stage} from '../types';

export const outboundStageNames=[
  'Encontrado',
  'Calificado',
  'Demo lista',
  'DM enviado',
  'Respondió',
  'Llamada',
  'Ganado',
  'Perdido',
] as const;

export type OutboundStageName=typeof outboundStageNames[number];

const colors=['#64748b','#2563eb','#7c3aed','#d97706','#0891b2','#db2777','#16a34a','#dc2626'];

export const outboundStages=(tenant:string):Stage[]=>outboundStageNames.map((name,index)=>({
  id:`outbound-${index+1}`,
  tenantId:tenant,
  name,
  order:index,
  color:colors[index],
}));

const legacyMap:Record<string,OutboundStageName>={
  Nuevo:'Encontrado',
  Contactado:'DM enviado',
  Propuesta:'Llamada',
  Ganado:'Ganado',
  Perdido:'Perdido',
};

export function ensureOutboundFunnel(data:CrmData,tenant:string):CrmData{
  if(tenant==='jobs')return data;
  const alreadyOutbound=outboundStageNames.every(name=>data.stages.some(stage=>stage.name===name));
  if(alreadyOutbound)return data;

  const stages=outboundStages(tenant);
  const oldNameById=new Map(data.stages.map(stage=>[stage.id,stage.name]));
  const idByName=new Map(stages.map(stage=>[stage.name,stage.id]));
  const deals=data.deals.map(deal=>{
    const oldName=oldNameById.get(deal.stageId)??'Nuevo';
    const mapped=legacyMap[oldName]??(outboundStageNames.includes(oldName as OutboundStageName)?oldName as OutboundStageName:'Encontrado');
    return {...deal,stageId:idByName.get(mapped)??stages[0].id};
  });

  return {...data,stages,deals};
}

export const stageIdByName=(stages:Stage[],name:OutboundStageName)=>stages.find(stage=>stage.name===name)?.id;
