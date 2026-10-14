import {id, monthOf, today, sum} from './core.js';

export const PHOTO_BUDGET = [
 ['生活費',75000,'home','fixed','#B9985B'],
 ['自由費',50000,'sparkles','free','#666DE3'],
 ['自由費（家族）',11660,'heart','free','#9181C8'],
 ['燃料費',15000,'train','free','#D88C68'],
 ['自動車費',11800,'train','fixed','#BA8171'],
 ['通勤費',6000,'train','free','#929CC0'],
 ['積立投資',10000,'leaf','saving','#599E9A'],
 ['財形貯蓄',10000,'wallet','saving','#6A9BAE'],
 ['定期貯金',50000,'wallet','saving','#798FAC'],
 ['通信費',10540,'phone','fixed','#B284A0'],
];
export function makePhotoBudget(data,groupId,month=monthOf(today())) {
 const allocations={};
 for(const [order,[name,value,icon,bucket,color]] of PHOTO_BUDGET.entries()) {
  let category=data.categories.find(c=>c.groupId===groupId&&c.type==='expense'&&c.name===name&&!c.archived);
  if(!category){category={id:id(),groupId,name,icon,bucket,color,order:order-20,type:'expense',role:'other',hidden:false,archived:false,weight:1};data.categories.push(category);}
  allocations[category.id]=value;
 }
 return {id:`${groupId}:${month}`,groupId,month,mode:'manual',salary:0,fixed:0,savingRate:0,savingGoal:0,limit:sum(PHOTO_BUDGET.map(x=>x[1])),shortfall:0,allocations,hasHistory:false,createdAt:new Date().toISOString()};
}
// Apply once, only to the personal group. Never replace a saved budget or a transaction.
export function seedPhotoBudget(data,month=monthOf(today())) {
 const settings=data.settings[0];
 if(settings.photoBudgetSeed===1)return false;
 const group=data.groups.find(g=>g.name==='プライベート')||data.groups.find(g=>g.id===settings.activeGroup)||data.groups[0];
 if(!data.budgets.some(b=>b.groupId===group.id&&b.month===month))data.budgets.push(makePhotoBudget(data,group.id,month));
 settings.photoBudgetSeed=1;
 return true;
}
