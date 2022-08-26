import axios from "axios";
import config from "./config";
const base = config.baseUrl
export const getToken = () => axios.get(`${base}/api`);
