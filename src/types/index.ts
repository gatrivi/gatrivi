export interface Contact { id:string; tenantId:string; name:string; phone:string; email:string; company:string; notes:string; createdAt:string }
export interface Stage { id:string; tenantId:string; name:string; order:number; color:string }
export interface Deal { id:string; tenantId:string; contactId:string; title:string; stageId:string; value:number; currency:string; createdAt:string; updatedAt:string }
export interface Task { id:string; tenantId:string; contactId?:string; dealId?:string; title:string; dueDate:string; done:boolean }
export interface CrmData { contacts:Contact[]; stages:Stage[]; deals:Deal[]; tasks:Task[] }
