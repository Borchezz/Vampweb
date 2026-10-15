import { bootstrap } from "../events-bootstrap.js";
import { state } from "../state.js";

export async function bootstrapDaytime({ adapter } = {}) {
  await bootstrap();
  adapter?.publishDaytimeSettlement({ day: state.day, resources: state.resources });
  return { adapter };
}
