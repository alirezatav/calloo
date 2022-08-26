import config from "../config";
const base = config.baseUrlWs;

const ws = (isDev) => {
  let path = base;
  const wsConnection = new WebSocket(path);

  wsConnection.onerror = (e) => {
    console.log("ERROR >>>>", e);
  };

  return wsConnection;
};
export default ws;
