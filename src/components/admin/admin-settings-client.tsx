'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Bot, ChevronDown, CreditCard, Loader2, Lock, Mail, MessageCircle, Settings2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminNav } from './admin-nav';

export function AdminSettingsClient() {
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [advanced,setAdvanced]=useState(false);
  const [config,setConfig]=useState({default_trial_days:'14',max_workspace_users_default:'5',max_workspace_contacts_default:'1000',maintenance_mode:'false'});
  async function loadData(){setLoading(true);try{const res=await fetch('/api/admin/settings');if(res.ok){const data=await res.json();const s=data.settings||{};setConfig({default_trial_days:s.default_trial_days||'14',max_workspace_users_default:s.max_workspace_users_default||'5',max_workspace_contacts_default:s.max_workspace_contacts_default||'1000',maintenance_mode:s.maintenance_mode||'false'});}}catch{toast.error('Settings could not be loaded. Please try again.');}finally{setLoading(false);}}
  useEffect(()=>{loadData();},[]);
  async function save(e:React.FormEvent){e.preventDefault();setSaving(true);try{const res=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:config})});if(!res.ok)throw new Error();toast.success('Settings saved');await loadData();}catch{toast.error('Settings could not be saved. Please try again.');}finally{setSaving(false);}}
  const groups=[{label:'General',desc:'Business defaults and trial settings',icon:Settings2},{label:'Security',desc:'Account access and protection',icon:Shield},{label:'Notifications',desc:'Choose which updates you receive',icon:Bell},{label:'Email',desc:'Email delivery preferences',icon:Mail},{label:'WhatsApp',desc:'Business messaging preferences',icon:MessageCircle},{label:'AI',desc:'AI service preferences',icon:Bot},{label:'Billing',desc:'Plans, payments and invoices',icon:CreditCard}];
  return <div><AdminNav onRefresh={loadData} loading={loading}/><main className="mx-auto max-w-5xl space-y-8 pb-12 lg:pt-20"><header><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1><p className="mt-2 text-sm text-neutral-500 sm:text-base">Manage Helpa&apos;s everyday business preferences.</p></header>
    {loading?<div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-400"/></div>:<>
      <section className="grid gap-3 sm:grid-cols-2">{groups.map(({label,desc,icon:Icon})=><div key={label} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-900"><Icon className="h-4 w-4 text-neutral-500"/></div><div><p className="text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs text-neutral-500">{desc}</p></div></div>)}</section>
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"><button type="button" onClick={()=>setAdvanced(v=>!v)} className="flex min-h-16 w-full items-center gap-3 px-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900" aria-expanded={advanced}><Lock className="h-4 w-4 text-neutral-500"/><div className="flex-1"><p className="text-sm font-semibold">Advanced</p><p className="text-xs text-neutral-500">Defaults used when a new business joins</p></div><ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${advanced?'rotate-180':''}`}/></button>
      {advanced&&<form onSubmit={save} className="space-y-5 border-t border-neutral-200 p-5 dark:border-neutral-800"><div className="grid gap-4 sm:grid-cols-3"><Field id="trial" label="Trial length (days)" value={config.default_trial_days} onChange={v=>setConfig(p=>({...p,default_trial_days:v}))}/><Field id="members" label="Default team members" value={config.max_workspace_users_default} onChange={v=>setConfig(p=>({...p,max_workspace_users_default:v}))}/><Field id="contacts" label="Default contacts" value={config.max_workspace_contacts_default} onChange={v=>setConfig(p=>({...p,max_workspace_contacts_default:v}))}/></div><div className="flex flex-col justify-between gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center dark:border-neutral-900"><p className="text-xs text-neutral-500">These defaults only apply to new businesses.</p><Button type="submit" disabled={saving}>{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}Save settings</Button></div></form>}</section>
    </>}
  </main></div>;
}
function Field({id,label,value,onChange}:{id:string;label:string;value:string;onChange:(value:string)=>void}){return <div className="space-y-2"><Label htmlFor={id} className="text-sm">{label}</Label><Input id={id} type="number" value={value} onChange={e=>onChange(e.target.value)} className="h-11"/></div>}
