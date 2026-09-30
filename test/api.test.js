// Smoke test against the local dev server (ADMIN_EMAILS=jill@snacksdesign.com npm run dev), starting from an empty .localdata
import assert from "node:assert/strict";
const B = process.env.BASE || "http://localhost:3000";
async function login(email) {
  const r = await (await fetch(B + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) })).json();
  if (!r.devLink) return null;
  const v = await fetch(r.devLink, { redirect: "manual" });
  return v.headers.get("set-cookie").split(";")[0];
}
const call = async (cookie, path, body) => {
  const r = await fetch(B + "/api" + path, body ? { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) } : { headers: { cookie } });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const admin = await login("jill@snacksdesign.com");
assert.ok(admin, "admin can log in");
let st = (await call(admin, "/state")).data;
assert.equal(st.schedule.length, 30);
assert.deepEqual(st.schedule[0].dropoff.stillNeed, ["will", "victoria"]);
assert.deepEqual(st.schedule[1].dropoff.stillNeed, []);
assert.deepEqual(st.schedule[1].pickup.stillNeed, ["james", "will"]);
assert.deepEqual(st.schedule[10].dropoff.stillNeed, ["james", "victoria"]); // Wed
assert.deepEqual(st.schedule[10].pickup.stillNeed, ["will", "victoria"]);

assert.equal(await login("pat@example.com"), null, "unknown parent gets no link");
const kids = st.config.kids.map((k) => ({ ...k, parents: k.id === "will" ? ["pat@example.com"] : k.parents }));
assert.equal((await call(admin, "/admin/config", { kids })).status, 200);
const pat = await login("pat@example.com");
assert.ok(pat, "added parent can log in");
st = (await call(pat, "/state")).data;
assert.deepEqual(Object.keys(st.needs), ["will"], "parent only sees own child's needs");
assert.equal(st.config.kids[0].parents, undefined, "parent emails hidden from non-admin");
assert.equal((await call(pat, "/needs", { kidId: "james", usual: { Tuesday: "none" } })).status, 403);
assert.equal((await call(pat, "/needs", { kidId: "will", overrides: { "2026-10-20": "pickup" } })).status, 200);
assert.equal((await call(pat, "/admin/config", { admins: ["pat@example.com"] })).status, 403);
assert.equal((await call(pat, "/rides/drive", { date: "2026-10-20", leg: "dropoff", seats: 2 })).status, 400, "needs name first");
await call(pat, "/profile", { name: "Pat", phone: "555-0100" });
assert.equal((await call(pat, "/rides/drive", { date: "2026-10-20", leg: "pickup", seats: 1 })).status, 200);
assert.equal((await call(pat, "/rides/claim", { date: "2026-10-20", leg: "pickup", kidId: "james" })).status, 200);
assert.equal((await call(pat, "/rides/claim", { date: "2026-10-20", leg: "pickup", kidId: "victoria" })).status, 409, "car full");
assert.equal((await call(pat, "/rides/withdraw", { date: "2026-10-06", leg: "dropoff", email: "jill@snacksdesign.com" })).status, 403);
st = (await call(pat, "/state")).data;
const oct20 = st.schedule.find((d) => d.id === "2026-10-20");
assert.deepEqual(oct20.dropoff.stillNeed, ["james", "victoria"], "override removed Will from drop-off");
assert.deepEqual(oct20.pickup.stillNeed, ["will", "victoria"]);
assert.equal(st.people["pat@example.com"].phone, "555-0100");
const csv = await fetch(B + "/api/admin/export.csv", { headers: { cookie: admin } });
assert.equal(csv.status, 200);
assert.equal((await fetch(B + "/api/admin/export.csv", { headers: { cookie: pat } })).status, 403);
assert.equal((await call(admin, "/admin/config", { admins: [], kids: st.config.kids.map(k=>({id:k.id,name:k.name,parents:[]})) })).status, 200, "env admin stays admin");
assert.equal((await call(pat, "/state")).status, 401, "removed parent is locked out");
console.log("All API tests passed ✔");
