// API checks. Start the site first (npm run dev, with ADMIN_EMAILS=jill@snacksdesign.com), then: npm test
import assert from "node:assert/strict";
const B = process.env.BASE || "http://localhost:8888";
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
// Kids have database ids; look them up by name.
const K = Object.fromEntries(st.config.kids.map((k) => [k.name.toLowerCase(), k.id]));
const at = (st, date) => st.schedule.find((d) => d.id === date);
assert.equal(st.schedule.length, 51, "30 seeded dates plus a Wednesday after each of the 21 Tuesdays");
assert.deepEqual(at(st, "2026-10-06").dropoff.stillNeed, [K.will, K.victoria]);
assert.deepEqual(at(st, "2026-10-13").dropoff.stillNeed, []);
assert.deepEqual(at(st, "2026-10-13").pickup.stillNeed, [K.james, K.will]);
assert.equal(at(st, "2026-12-16").allSchools, true, "seeded Wednesdays are all-school");
assert.deepEqual(at(st, "2026-12-16").dropoff.stillNeed, [K.james, K.victoria]);
assert.deepEqual(at(st, "2026-12-16").pickup.stillNeed, [K.will, K.victoria]);
assert.equal(at(st, "2026-10-07").allSchools, false, "added Wednesday is a regular day");
assert.equal(at(st, "2026-10-07").note, "Wednesday (Non Park View day)");
assert.deepEqual(at(st, "2026-10-07").dropoff.needing, [], "nobody's regular day is Wednesday yet");

assert.equal(await login("pat@example.com"), null, "unknown parent gets no link");
const denied = await fetch(B + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "pat@example.com" }) });
assert.equal(denied.status, 403, "unknown email is refused");
assert.match((await denied.json()).error, /isn't on the parent list/);
const kids = st.config.kids.map((k) => ({ ...k, parents: k.id === K.will ? ["pat@example.com"] : k.parents }));
assert.equal((await call(admin, "/admin/config", { kids })).status, 200);
const pat = await login("pat@example.com");
assert.ok(pat, "added parent can log in");
st = (await call(pat, "/state")).data;
assert.deepEqual(Object.keys(st.needs), [String(K.will)], "parent only sees own child's needs");
assert.equal(st.config.kids[0].parents, undefined, "parent emails hidden from non-admin");
assert.equal((await call(pat, "/needs", { kidId: K.james, usual: { Tuesday: "none" } })).status, 403);
assert.equal((await call(pat, "/needs", { kidId: K.will, overrides: { "2026-10-20": "pickup" } })).status, 200);
assert.equal((await call(pat, "/needs", { kidId: K.will, regularDay: "Monday" })).status, 400, "regular day must be a rehearsal weekday");
assert.equal((await call(pat, "/needs", { kidId: K.will, regularDay: "Wednesday", usual: { Wednesday: "both" } })).status, 200);
st = (await call(pat, "/state")).data;
assert.equal(st.needs[K.will].regularDay, "Wednesday");
assert.ok(at(st, "2026-10-21").dropoff.needing.includes(K.will), "Wednesday kid rides on regular Wednesdays");
assert.ok(!at(st, "2026-10-27").dropoff.needing.includes(K.will), "and not on Tuesdays");
assert.ok(at(st, "2026-12-16").pickup.needing.includes(K.will), "and still on all-school Wednesdays");
assert.equal((await call(pat, "/needs", { kidId: K.will, overrides: { "2026-10-27": "dropoff" } })).status, 200);
assert.ok(at((await call(pat, "/state")).data, "2026-10-27").dropoff.needing.includes(K.will), "a single-week change counts on the other day");
assert.equal((await call(pat, "/needs", { kidId: K.will, regularDay: "Tuesday", overrides: { "2026-10-27": null } })).status, 200);
assert.equal((await call(pat, "/admin/config", { admins: ["pat@example.com"] })).status, 403);
assert.equal((await call(pat, "/rides/drive", { date: "2026-10-20", leg: "dropoff", seats: 2 })).status, 400, "needs name first");
await call(pat, "/profile", { name: "Pat", phone: "555-0100" });
assert.equal((await call(pat, "/rides/drive", { date: "2026-10-20", leg: "pickup", seats: 1 })).status, 200);
assert.equal((await call(pat, "/rides/claim", { date: "2026-10-20", leg: "pickup", kidId: K.james })).status, 200);
assert.equal((await call(pat, "/rides/claim", { date: "2026-10-20", leg: "pickup", kidId: K.victoria })).status, 409, "car full");
assert.equal((await call(pat, "/rides/withdraw", { date: "2026-10-06", leg: "dropoff", email: "jill@snacksdesign.com" })).status, 403);
st = (await call(pat, "/state")).data;
const oct20 = st.schedule.find((d) => d.id === "2026-10-20");
assert.deepEqual(oct20.dropoff.stillNeed, [K.james, K.victoria], "override removed Will from drop-off");
assert.deepEqual(oct20.pickup.stillNeed, [K.will, K.victoria]);
assert.equal(st.people["pat@example.com"].phone, "555-0100");
const csv = await fetch(B + "/api/admin/export.csv", { headers: { cookie: admin } });
assert.equal(csv.status, 200);
assert.equal((await fetch(B + "/api/admin/export.csv", { headers: { cookie: pat } })).status, 403);
assert.equal((await call(admin, "/admin/config", { admins: [] })).status, 400, "admins can't remove themselves");
assert.equal((await call(admin, "/admin/config", { admins: ["jill@snacksdesign.com"], kids: st.config.kids.map(k=>({id:k.id,name:k.name,parents:[]})) })).status, 200);
assert.equal((await call(pat, "/state")).status, 401, "removed parent is locked out");
console.log("All API tests passed ✔");

// --- extra drivers added by another parent ---
{
  const a2 = await login("jill@snacksdesign.com");
  const kids = (await call(a2, "/state")).data.config.kids.map((k) => ({ ...k, parents: k.id === K.will ? ["pat@example.com"] : k.parents }));
  await call(a2, "/admin/config", { kids });
  const p2 = await login("pat@example.com");
  assert.equal((await call(p2, "/rides/add-driver", { date: "2026-10-27", leg: "pickup", name: "Sam", seats: 2 })).status, 403, "only admins add other drivers");
  // Admin adds Sam; admin manages that car.
  const add = await call(a2, "/rides/add-driver", { date: "2026-10-27", leg: "pickup", name: "Sam", phone: "555-0111", seats: 2 });
  assert.equal(add.status, 200);
  let st2 = (await call(p2, "/state")).data;
  const sam = st2.schedule.find((d) => d.id === "2026-10-27").pickup.drivers.find((x) => x.name === "Sam");
  assert.ok(sam && sam.addedBy === "jill@snacksdesign.com");
  assert.equal((await call(p2, "/rides/claim", { date: "2026-10-27", leg: "pickup", kidId: K.victoria, driver: sam.email })).status, 403, "parents can't fill a car they didn't add");
  assert.equal((await call(a2, "/rides/claim", { date: "2026-10-27", leg: "pickup", kidId: K.victoria, driver: sam.email })).status, 200, "admin can fill that car");
  assert.equal((await call(a2, "/rides/drive", { date: "2026-10-27", leg: "pickup", driver: sam.email, seats: 10 })).status, 200, "admin can change seats up to 10");
  await call(a2, "/profile", { name: "Jill" });
  await call(a2, "/rides/drive", { date: "2026-10-27", leg: "dropoff", seats: 3 });
  assert.equal((await call(p2, "/rides/claim", { date: "2026-10-27", leg: "dropoff", kidId: K.will, driver: "jill@snacksdesign.com" })).status, 403, "can't fill someone else's car");
  assert.equal((await call(p2, "/rides/withdraw", { date: "2026-10-27", leg: "pickup", email: sam.email })).status, 403, "parents can't remove it");
  assert.equal((await call(a2, "/rides/withdraw", { date: "2026-10-27", leg: "pickup", email: sam.email })).status, 200, "admin can remove it");
  console.log("Extra-driver tests passed ✔");
}

// --- home addresses: only parents, admins and that child's drivers can see them ---
{
  const a3 = await login("jill@snacksdesign.com");
  const kids = (await call(a3, "/state")).data.config.kids.map((k) => ({ ...k, parents: k.id === K.will ? ["pat@example.com"] : k.id === K.victoria ? ["vic@example.com"] : k.parents }));
  await call(a3, "/admin/config", { kids });
  const pat = await login("pat@example.com");
  const vic = await login("vic@example.com");
  assert.equal((await call(pat, "/kidinfo", { kidId: K.victoria, address: "x" })).status, 403);
  assert.equal((await call(vic, "/kidinfo", { kidId: K.victoria, address: "9 Oak Ave, Lombard", notes: "Side door" })).status, 200);
  assert.equal((await call(pat, "/state")).data.kidInfo[K.victoria], undefined, "not visible before driving her");
  await call(pat, "/profile", { name: "Pat" });
  await call(pat, "/rides/drive", { date: "2026-11-10", leg: "pickup", seats: 3 });
  await call(pat, "/rides/claim", { date: "2026-11-10", leg: "pickup", kidId: K.victoria });
  const info = (await call(pat, "/state")).data.kidInfo[K.victoria];
  assert.equal(info.address, "9 Oak Ave, Lombard");
  assert.equal(info.notes, "Side door");
  assert.equal((await call(a3, "/state")).data.kidInfo[K.victoria].address, "9 Oak Ave, Lombard", "admin sees it");
  console.log("Address tests passed ✔");
}

// --- parents can take their own child out of a car, and "No ride needed" takes them out automatically ---
{
  const pat = await login("pat@example.com");
  const vic = await login("vic@example.com");
  const car = async () => (await call(pat, "/state")).data.schedule.find((d) => d.id === "2026-11-10").pickup.drivers.find((x) => x.email === "pat@example.com");
  assert.ok((await car()).kids.includes(K.victoria), "Victoria starts in Pat's car");
  assert.equal((await call(vic, "/rides/claim", { date: "2026-11-10", leg: "pickup", kidId: K.will, driver: "pat@example.com", add: false })).status, 403, "can't remove someone else's child");
  assert.equal((await call(vic, "/rides/claim", { date: "2026-11-10", leg: "pickup", kidId: K.victoria, driver: "pat@example.com", add: true })).status, 403, "can't add to someone else's car");
  assert.equal((await call(vic, "/rides/claim", { date: "2026-11-10", leg: "pickup", kidId: K.victoria, driver: "pat@example.com", add: false })).status, 200, "parent removes own child");
  assert.ok(!(await car()).kids.includes(K.victoria));
  await call(pat, "/rides/claim", { date: "2026-11-10", leg: "pickup", kidId: K.victoria });
  assert.ok((await car()).kids.includes(K.victoria), "back in the car");
  assert.equal((await call(vic, "/needs", { kidId: K.victoria, overrides: { "2026-11-10": "dropoff" } })).status, 200);
  assert.ok(!(await car()).kids.includes(K.victoria), "switching to drop-off only takes her out of the pickup car");
  console.log("Remove-from-car tests passed ✔");
}
