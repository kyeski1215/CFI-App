// How each graded skill reads in a debrief text: a plain name, a short coaching tip for when it
// needs work, an optional chair-fly prompt, and words that tie your notes to it.
// Tips are general technique; your airplane's POH numbers always win.

export interface SkillTip {
  say: string; // how the skill reads in a sentence ("your radio calls")
  tip?: string; // what to do about it
  chair?: string; // what to chair fly
  keys?: string[]; // words in your notes that are about this skill
}

const CHECKLIST: SkillTip = { say: "checklist use", tip: "Read it, do it, check it off. Back up every flow with the checklist instead of going from memory.", keys: ["checklist"] };

export const SKILL_TIPS: Record<string, SkillTip> = {
  // Ground & departure
  Preflight: { say: "your preflight", tip: "Go top to bottom with the checklist in hand and touch each item. Check fuel and oil yourself, every time.", keys: ["preflight", "walkaround", "walk-around", "fuel", "oil"] },
  "Checklist usage": CHECKLIST,
  Taxi: { say: "taxiing", tip: "Brisk walking pace, eyes outside, and hold the controls for the wind.", keys: ["taxi"] },
  "Run-up": { say: "the run-up", tip: "Nose into the wind, brakes firm, and go line by line. Know the mag drop that would keep you on the ground.", keys: ["run-up", "runup", "run up", "mag"] },
  "Untowered radio calls": { say: "your radio calls", tip: "Airport, who you are, where you are, what you're doing, airport again. Plan the call before you key the mic.", chair: "your radio calls from taxi to departure, out loud", keys: ["radio", "call", "ctaf", "unicom"] },
  "Towered radio calls": { say: "talking to ground and tower", tip: "Listen first, then who you are, where you are, what you want. Always read back runways and hold-short instructions.", chair: "the call to ground and the readback of your taxi clearance", keys: ["tower", "ground", "atc", "readback", "read back", "clearance"] },
  "Normal takeoff": { say: "your takeoffs", tip: "Right rudder as the power comes in, rotate at Vr, then pitch for Vy and trim.", keys: ["takeoff", "take off", "take-off", "rotate", "rotation", "liftoff"] },
  "Crosswind takeoff": { say: "crosswind takeoffs", tip: "Full aileron into the wind to start and ease it out as you speed up, then let it crab once you're airborne.", keys: ["crosswind takeoff", "crosswind t/o"] },
  "Short field takeoff": { say: "short field takeoffs", tip: "Use every foot of runway, flaps per the POH, full power on the brakes, then climb at Vx until you're clear of the obstacle.", keys: ["short field takeoff", "short-field takeoff", "vx"] },
  "Soft field takeoff": { say: "soft field takeoffs", tip: "Keep it rolling with back pressure to get the nosewheel light, lift off early and stay in ground effect to build speed.", keys: ["soft field takeoff", "soft-field takeoff", "ground effect"] },

  // Airwork
  "Checklist usage · Airwork": { ...CHECKLIST, say: "checklist use before maneuvers", tip: "Run the pre-maneuver checklist (clearing turns, area, altitude) before every maneuver, not just the first.", keys: ["craac", "clearing turn", "pre-maneuver"] },
  "Straight & level": { say: "holding altitude and heading", tip: "Set the pitch picture on the horizon, trim, then scan: outside, instruments, outside.", keys: ["altitude", "heading", "straight and level", "straight & level"] },
  "Climbs & descents": { say: "climbs and descents", tip: "Pitch, power, trim. Lead your level-off by about 10% of your climb or descent rate.", keys: ["climb", "descent", "level off", "level-off"] },
  Turns: { say: "turns", tip: "Roll in with aileron and rudder together, hold the bank on the horizon, and add a little back pressure. Keep the ball centered.", keys: ["turn", "bank", "coordinat", "ball"] },
  Trim: { say: "trim", tip: "Hold the attitude you want, then trim until you can let go. If you're holding pressure, you're not done trimming.", keys: ["trim"] },
  "Collision avoidance": { say: "scanning for traffic", tip: "Scan in small sectors, pausing on each, and clear the area before every turn and maneuver.", keys: ["traffic", "scan", "clearing"] },
  "Slow flight": { say: "slow flight", tip: "Pitch for airspeed, power for altitude, and plenty of right rudder to keep the ball centered.", chair: "the slow flight entry: power, pitch, flaps, trim", keys: ["slow flight", "slow-flight"] },
  "Power-off stalls": { say: "power-off stalls", tip: "When it breaks, lower the nose just enough to break the stall, level the wings, then full power.", chair: "the power-off stall recovery, out loud", keys: ["power-off", "power off", "landing stall"] },
  "Power-on stalls": { say: "power-on stalls", tip: "Hold right rudder as the nose comes up. Recover by lowering the nose and leveling the wings, without a second stall.", chair: "the power-on stall entry and recovery", keys: ["power-on", "power on", "departure stall"] },
  "Steep turns": { say: "steep turns", tip: "Roll to 45°, add back pressure and a touch of power as you pass 30°, and hold the horizon on the cowling. Start the rollout about 20° early.", chair: "the steep turn: entry, sight picture and rollout", keys: ["steep turn", "steep-turn"] },
  "Ground reference": { say: "ground reference", tip: "Steepest bank where your groundspeed is highest (downwind), shallowest where it's slowest. Eyes outside.", keys: ["ground reference", "turns around a point", "s-turn", "rectangular"] },

  // Emergencies
  "Checklist usage · Emergencies": { ...CHECKLIST, say: "using the emergency checklist", tip: "Fly the airplane first, do the memory items, then confirm every step with the POH checklist.", keys: ["emergency checklist"] },
  "Emergency procedures": { say: "emergency procedures", tip: "ABCD: airspeed, best place to land, checklist, declare. Say it out loud every time.", chair: "ABCD for an engine failure at cruise", keys: ["emergency", "abcd", "fire", "electrical"] },
  "Engine-out / forced landing": { say: "the engine-out", tip: "Best glide right away, pick a field you can easily reach, then fly a normal-looking pattern to it.", chair: "an engine failure: best glide, field, checklist, declare", keys: ["engine out", "engine-out", "engine failure", "forced landing", "glide", "field"] },
  "Power-off 180": { say: "power-off 180s", tip: "Abeam the numbers: power idle, pitch for best glide, and judge the turn to final. Flaps only once you've got the runway made.", keys: ["180", "power-off 180"] },

  // Pattern & landings
  "Untowered radio calls · Pattern": { say: "radio calls in the pattern", tip: "Downwind, base and final calls, with the airport name at the start and the end.", keys: ["radio", "call", "ctaf"] },
  "Towered radio calls · Pattern": { say: "talking to tower in the pattern", tip: "Read back your landing clearance and any sequencing, and keep flying the airplane while you talk.", keys: ["tower", "atc", "readback", "read back"] },
  "Traffic pattern": { say: "a solid pattern", tip: "Pattern altitude ±100 ft, a square pattern with good spacing, and the same power and configuration at the same points every lap.", chair: "the pattern: power, flaps and speeds at each point", keys: ["pattern", "downwind", "base", "crosswind leg", "upwind"] },
  "Pre-landing checklist": { say: "the pre-landing checklist", tip: "Say GUMPS out loud on downwind, abeam the numbers, every lap.", chair: "GUMPS on downwind, out loud", keys: ["gumps", "pre-landing", "prelanding", "before landing"] },
  "Stabilized approach": { say: "stable approaches", tip: "By 500 ft: on speed, on glidepath, configured and lined up. If not, go around.", keys: ["stabilized", "stable", "approach", "final"] },
  "Normal landing": { say: "landings", tip: "Over the threshold start the round-out, then keep easing back to hold it off, with your eyes at the far end of the runway. Touch down on the mains.", chair: "the flare: round-out height, eyes at the far end, holding it off", keys: ["landing", "flare", "float", "round-out", "round out", "touchdown", "bounce", "balloon"] },
  "Crosswind landing": { say: "crosswind landings", tip: "Change from crab to wing-low on short final: upwind aileron to stop the drift, opposite rudder to keep the nose straight. Add aileron as you slow down.", chair: "the crab-to-wing-low change on short final", keys: ["crosswind", "drift", "crab", "wing low", "wing-low"] },
  "Short field landing": { say: "short field landings", tip: "Exact approach speed, aim at your point, and a firm touchdown with no float, then flaps up and max braking.", keys: ["short field", "short-field"] },
  "Soft field landing": { say: "soft field landings", tip: "Touch down as slowly as possible with a little power and hold the nosewheel off as long as you can.", keys: ["soft field", "soft-field"] },
  "Forward slip": { say: "forward slips", tip: "Aileron to lower a wing, opposite rudder to keep the track straight, and lower the nose to hold airspeed.", keys: ["slip"] },
  "Go-around": { say: "go-arounds", tip: "Full power, pitch for Vy, clean up flaps in steps once you're climbing, and sidestep to keep traffic in sight.", chair: "a go-around: power, pitch, flaps, climb", keys: ["go-around", "go around", "goaround"] },
};

/** Plain name and tip for any skill, including ones you added yourself. */
export function tipFor(skill: string): SkillTip {
  const t = SKILL_TIPS[skill];
  if (t) return t;
  const name = skill.replace(/ · .*$/, "");
  return { say: name.charAt(0).toLowerCase() + name.slice(1), keys: [name.toLowerCase()] };
}
/** Capitalized name for a "to work on" line. */
export const headName = (skill: string) => {
  const s = tipFor(skill).say.replace(/^(your|the|a) /, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
