"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function LootNotification() {
  const [unopened,setUnopened]=useState(0);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    async function refresh() {
      if(document.hidden)return;
      try {
        const response=await fetch("/api/v1/loot/notifications",{cache:"no-store",signal:controller.signal});
        if(response.ok){const body=await response.json();if(active)setUnopened(body.unopened);}
      }catch{/* Navigation and offline checks should not interrupt browsing. */}
    }
    void refresh();const timer=setInterval(()=>void refresh(),60000);
    window.addEventListener("focus",refresh);
    window.addEventListener("skystore-loot-updated",refresh);
    return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("skystore-loot-updated",refresh);};
  },[]);
  return <Link className="outline loot-notification" href="/loot-boxes" aria-label={unopened?`Event boxes: ${unopened} ready to open`:"Event boxes"}>Event boxes {unopened>0&&<b>{unopened}</b>}</Link>;
}
