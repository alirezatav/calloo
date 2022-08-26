import { getToken } from "./routes.js";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import Axios from "axios";

let users = {};
let callsData = {};

const app = express();
app.use(cors());

app.get("/api", getToken);
app.listen(4000, "127.0.0.1", () => {
  console.log("listening on localhost ...");
});

const wss = new WebSocketServer({ port: 4003 });

wss.on("connection", function (ws) {
  ws.on("message", function (message) {
    let data;
    let msg = message.toString();
    if (msg === "heartbeat") {
      ws.send("heartbeat");
      return;
    }
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    if (users[data.token] && users[data.token] !== ws) {
      // users[data.token].close();
    }

    console.log("received data:", data);
    switch (data.type) {
      case "login": {
        if (!data.token) {
          //TODO validate token
          sendTo(ws, {
            type: "alert",
            text: "خطا در ورود",
          });
        } else {
          users[data.token] = ws;
          ws.name = data.token;
          ws.user_token = data.token;
          sendTo(ws, {
            type: "login",
            success: true,
          });
        }

        break;
      }
      case "offer": {
        let conn = users[data.name];
        if (conn) {
          ws.otherName = data.name;
          sendTo(conn, {
            type: "offer",
            offer: data.offer,
            name: ws.name,
          });
        }
        break;
      }
      case "call-state": {
        let conn = users[data.token];
        if (conn) {
          ws.callState = data.state;
        }
        break;
      }
      case "send-sms": {
        let token = data.token;
        let cid = `${String(Date.now()).substr(2)}${Math.floor(
          Math.random() * 1000
        )}`;
        callsData[cid] = { from: { token, ws }, to: {}, status: "pending" };

        sendTo(ws, {
          type: "info",
          cid,
        });

        sendSms(data.callee, `https://calloo.xyz?cid=${cid}`)
          .then(() => {
            sendTo(ws, {
              type: "alert",
              text: "پیامک با موفقیت ارسال شد",
            });
          })
          .catch(() => {
            sendTo(ws, {
              type: "alert",
              text: " خطا در ارسال پیامک",
            });
          });

        break;
      }
      case "sms-received": {
        let cid = data.cid;
        if (callsData[cid]) {
          callsData[cid].to = { ws, token: data.token };
          if (callsData[cid].status === "end") {
            sendTo(ws, {
              type: "call-ended",
            });
          } else {
            sendTo(ws, {
              type: "info",
              calleeName: callsData[cid].from.token,
            });
            sendTo(users[callsData[cid].from.token], {
              type: "call-to-user",
              destination: data.token,
              cid,
            });
          }
        } else {
          sendTo(ws, {
            type: "call-ended",
          });
        }

        break;
      }
      case "answer": {
        let conn = users[data.name];
        if (conn) {
          ws.otherName = data.name;
          sendTo(conn, {
            type: "answer",
            answer: data.answer,
          });
        }
        break;
      }
      case "candidate": {
        let conn = users[data.name];

        if (conn) {
          sendTo(conn, {
            type: "candidate",
            candidate: data.candidate,
          });
        }

        break;
      }
      case "leave": {
        let conn = users[data.name];  
        let cid = data.cid;

        ws.callState = "disconnect";
        if (callsData[cid]) {
          callsData[cid].status = "end";
        }
        if (conn) {
          conn.callState = "disconnect";
          conn.otherName = null;
          sendTo(conn, {
            type: "leave",
          });
        }
        break;
      }
      default:
        sendTo(ws, {
          type: "error",
          message: "Command not found: " + data.type,
        });

        break;
    }
  });

  ws.on("close", function () {
    ws.callState = "";
    if (ws.name) {
      if (ws.otherName) {
        console.log("Disconnecting from ", ws.otherName, Date.now());
        let conn = users[ws.otherName];
        if (conn) {
          conn.otherName = null;
          sendTo(conn, {
            type: "leave",
          });
        }
      }
    }
  });
});
async function sendSms(receptor, link) {
  console.log("send sent link :", link);
  let message = "«کـالـو»";
  message += "\n";
  message += "کاربری در خواست تماس برای شما ارسال کرده است.";
  message += "\n\n";
  message += "پیوستن به تماس:";
  message += "\n";
  message += link;
  message += "\n\n";
  message += "\n";
  message += "لغو=11";

  let body = {
    from: "xxxxxxxxxxxxxxxx",
    to: receptor,
    username: "xxxxxxxxxxx",
    password: "xxxxx",
    text: message,
  };

  // return Axios.post(`https://rest.payamak-panel.com/api/SendSMS/SendSMS`, body);
}
function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}
