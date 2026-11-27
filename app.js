import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { Capacitor } from "https://cdn.jsdelivr.net/npm/@capacitor/core@6.1.2/+esm";

const firebaseConfig = {
  apiKey: "AIzaSyAbSDJII3NJlUIExD9MGljoQf2-hKBamjc",
  authDomain: "zem-ensemble-benin.firebaseapp.com",
  projectId: "zem-ensemble-benin",
  storageBucket: "zem-ensemble-benin.firebasestorage.app",
  messagingSenderId: "982720625643",
  appId: "1:982720625643:web:58c4e11387e65a617377ae"
};
const $=id=>document.getElementById(id);
const status=$("status");
const places=["Aéroport de Cotonou","Cotonou centre (Ganhi)","Akpakpa","Dantokpa","Haie Vive","Cadjèhoun","Zogbo","Fidjrossè","Godomey","Abomey-Calavi","Université d’Abomey-Calavi (UAC)","Sèmè-Podji","Porto-Novo","Ouidah","Parakou","Bohicon","Abomey","Natitingou","Djougou","Kandi","Malanville","Lokossa","Dassa-Zoumè","Savalou","Savè","Kétou","Pobè","Sakété","Allada","Comè","Grand-Popo","Aplahoué","Dogbo","Nikki","Tanguiéta","Bembèrèkè","Kouandé","Banikoara","Glazoué","Bassila","Covè","Zagnanado","Agla","Gbégamey","Jéricho","Étoile Rouge","Menontin","Vèdoko","Akassato","Hêvié","Togoudo","Cococodji","Pahou","Ekpè","Ouèdo","Calavi Kpota"];
$("places").innerHTML=places.map(p=>`<option value="${p.replaceAll('"',"&quot;")}">`).join("");
$("o-date").value=new Date().toLocaleDateString("en-CA");
let auth,db,currentUser=null,allTrips=[],riderUnsub=null,filter=null,admin=false;
const configured=!firebaseConfig.apiKey.startsWith("REMPLACER_");
function message(t,error=false){status.textContent=t;status.classList.toggle("error",error);status.classList.remove("hidden")}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fmt(n){return new Intl.NumberFormat("fr-FR").format(Math.round(n||0))+" FCFA"}
function dateLabel(ts){return new Date(ts).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
function tab(which){$("search-form").classList.toggle("hidden",which!=="search");$("offer-form").classList.toggle("hidden",which!=="offer");$("tab-search").classList.toggle("active",which==="search");$("tab-offer").classList.toggle("active",which==="offer")}
$("tab-search").onclick=()=>tab("search");$("tab-offer").onclick=()=>tab("offer");
$("nav-home").onclick=()=>{ $("home").classList.remove("hidden");$("profile").classList.add("hidden");$("nav-home").classList.add("active");$("nav-profile").classList.remove("active") };
$("nav-profile").onclick=()=>{ $("home").classList.add("hidden");$("profile").classList.remove("hidden");$("nav-home").classList.remove("active");$("nav-profile").classList.add("active") };
$("role").onchange=()=>{$("fare-label").textContent=$("role").value==="pro"?"Prix par place (FCFA)":"Prix total du taxi (FCFA)";$("seats").min=$("role").value==="pro"?1:2;$("seats").max=$("role").value==="pro"?60:4};
function render(){
 let list=allTrips.filter(t=>Number(t.ts)>Date.now()-30*60*1000).sort((a,b)=>a.ts-b.ts);
 if(filter) list=list.filter(t=>t.from.toLowerCase().includes(filter.from.toLowerCase())&&t.to.toLowerCase().includes(filter.to.toLowerCase()));
 $("results-title").textContent=filter?`Résultats : ${filter.from} → ${filter.to}`:"Trajets disponibles";
 $("trips").innerHTML=list.length?list.map(t=>`<article class="trip"><div class="trip-route">📍 ${escapeHtml(t.from)} → ${escapeHtml(t.to)}</div><div class="trip-meta"><span>${dateLabel(t.ts)}</span><span class="pill">${t.role==="pro"?"Chauffeur / agence":"Partage entre passagers"}</span><span>${Math.max(0,t.seats-(t.joinedCount||1))} place(s) potentiellement libre(s)</span></div><div class="price">${fmt(t.role==="pro"?t.fare:t.fare/Math.max(1,t.joinedCount||1))}<span class="muted"> / personne</span></div><div class="muted">${t.role==="pro"?"Tarif annoncé par le chauffeur":"Prix estimé, partagé entre passagers"}</div>${t.owner===currentUser?.uid?'<span class="pill">Votre annonce</span>':`<button class="btn green" data-join="${t.id}">Demander une place</button>`}</article>`).join(""):'<div class="empty">Aucun trajet trouvé pour le moment. Vous pouvez proposer le premier !</div>';
}
$("search-form").onsubmit=e=>{e.preventDefault();filter={from:$("s-from").value.trim(),to:$("s-to").value.trim()};$("o-from").value=filter.from;$("o-to").value=filter.to;render()};
$("offer-form").onsubmit=async e=>{e.preventDefault();if(!db||!currentUser)return message("Configurez Firebase avant de publier.",true);
 const role=$("role").value,ts=new Date($("o-date").value+"T"+$("o-time").value).getTime(),seats=Number($("seats").value),fare=Number($("fare").value);
 if(ts<Date.now()-60000)return message("Choisissez une date et une heure futures.",true);
 if(role==="pax"&&(seats<2||seats>4))return message("Un taxi partagé doit avoir entre 2 et 4 places.",true);
 try{const ref=await addDoc(collection(db,"trips"),{from:$("o-from").value.trim(),to:$("o-to").value.trim(),ts,role,seats,fare,owner:currentUser.uid,ownerName:$("name").value.trim(),phone:$("phone").value.trim(),joinedCount:1,createdAt:serverTimestamp()});
 await setDoc(doc(db,"trips",ref.id,"riders",currentUser.uid),{uid:currentUser.uid,name:$("name").value.trim(),phone:$("phone").value.trim(),createdAt:serverTimestamp()});
 localStorage.setItem("ze-profile",JSON.stringify({name:$("name").value.trim(),phone:$("phone").value.trim()}));filter={from:$("o-from").value.trim(),to:$("o-to").value.trim()};tab("search");render();message("Trajet publié avec succès.");}
 catch(err){console.error(err);message("Publication refusée. Vérifiez les règles Firestore et votre connexion.",true)}
};
$("trips").onclick=async e=>{const id=e.target.dataset.join;if(!id||!db||!currentUser)return;
 const profile=JSON.parse(localStorage.getItem("ze-profile")||"{}");if(!profile.name||!profile.phone){message("Ajoutez votre prénom et WhatsApp dans Profil avant de réserver.",true);$("nav-profile").click();return}
 try{await setDoc(doc(db,"trips",id,"riders",currentUser.uid),{uid:currentUser.uid,name:profile.name,phone:profile.phone,createdAt:serverTimestamp()});message("Demande de place enregistrée. Contactez le conducteur directement.");}
 catch(err){console.error(err);message("Impossible de réserver : vérifiez les droits Firestore.",true)}
};
$("save-profile").onclick=()=>{const p={name:$("profile-name").value.trim(),phone:$("profile-phone").value.trim()};localStorage.setItem("ze-profile",JSON.stringify(p));$("name").value=p.name;$("phone").value=p.phone;message("Profil enregistré sur cet appareil.")};
$("admin-login").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("admin-email").value.trim(),$("admin-password").value);message("Connexion administrateur effectuée.");}catch(e){message("Connexion refusée. Vérifiez les identifiants.",true)}};
$("admin-logout").onclick=async()=>{await signOut(auth);admin=false;updateAdmin()};
function updateAdmin(){ $("admin-tools").classList.toggle("hidden",!admin);$("admin-logout").classList.toggle("hidden",!admin);$("admin-login").classList.toggle("hidden",admin);$("admin-state").textContent=admin?"Session administrateur active.":"Aucune session administrateur."}
const profile=JSON.parse(localStorage.getItem("ze-profile")||"{}");$("profile-name").value=profile.name||"";$("profile-phone").value=profile.phone||"";$("name").value=profile.name||"";$("phone").value=profile.phone||"";
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("/sw.js").catch(console.warn);
if(!configured){message("Projet prêt : ajoutez vos clés Firebase dans www/app.js pour activer les trajets partagés.");$("trips").innerHTML='<div class="empty">Mode aperçu — configurez Firebase pour activer les comptes et les trajets en ligne.</div>';}
else{
 try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async user=>{if(!user){try{await signInAnonymously(auth)}catch(e){message("Activez la connexion anonyme dans Firebase Authentication.",true)}return}
 currentUser=user;try{const token=await getIdTokenResult(user,true);admin=token.claims.admin===true}catch{admin=false}updateAdmin();
 onSnapshot(query(collection(db,"trips"),orderBy("ts","asc")),snap=>{allTrips=snap.docs.map(d=>({id:d.id,...d.data()}));render();message("Connecté — trajets synchronisés en direct.")},err=>{console.error(err);message("Lecture Firestore refusée : vérifiez firestore.rules.",true)});
 });
 }catch(e){console.error(e);message("Configuration Firebase incorrecte. Vérifiez www/app.js.",true)}
}
