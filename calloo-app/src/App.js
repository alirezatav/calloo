import React, { useEffect, useState, useRef } from "react";
import "./App.scss";
import Dial from "./components/dial";
import { getToken } from "./api";
import websocket from "./helpers/websocket";
import Toast from "./components/toast";
import callEnd from "./assets/endcall.svg";

let wsTry = 0;
const urlParams = new URLSearchParams(window.location.search);
const callId = urlParams.get("cid");

let pingPong;
let initialized = false;
const peerConnectionConfig = {
  iceServers: [
    {
      urls: "turn:141.11.182.64:3478",
      username: "alireza",
      credential: "44753",
    },
  ],
};

const downloadFile = (blob, fileName) => {
  const a = document.createElement("a");
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

function App() {
  const rtcConnection = useRef(null);
  const calleeName = useRef(undefined);
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();
  const myMediaStream = useRef(null);
  const browseFileRef = useRef();
  const toastRef = useRef(null);
  const toastTimeout = useRef(null);
  const senderVideoStream = useRef(null);
  const senderAudioStream = useRef(null);
  const retryWsTimeout = useRef(null);
  const cid = useRef(callId);
  const rtcVonnectionState = useRef("");
  const cidSmsSent = useRef(false);

  const [isWSConnected, setIsWSConnected] = useState(false);
  const [callingMode, setCallingMode] = useState(false);
  const [downloadigFile, setDownloadigFile] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [connecting, setConnecting] = useState(!!callId);
  const [toastText, setToastText] = useState("");
  const [waitingForAccept, setWaitingForAccept] = useState(false);

  const ws = useRef(null);

  const showToast = (text) => {
    clearTimeout(toastTimeout.current);
    setToastText(text);
    console.log(toastRef.current);
    var x = toastRef.current;
    x.classList.add("show");
    toastTimeout.current = setTimeout(function () {
      x.classList.remove("show");
    }, 5000);
  };

  const getUserToken = async (ws) => {
    try {
      if (localStorage.token) {
        ws.send(
          JSON.stringify({
            type: "login",
            token: localStorage.token,
          })
        );
        return localStorage.token;
      }
      const { data } = await getToken();
      localStorage.token = data.token;
      ws.send(
        JSON.stringify({
          type: "login",
          token: data.token,
        })
      );
      return data.token;
    } catch (error) {
      console.error(error);
    }
  };
  const getUserMedia = async () => {
    if (myMediaStream.current) return myMediaStream.current;
    let constraints = {};
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      devices.forEach((d) => {
        if (d.kind === "audioinput") constraints.audio = true;
        if (d.kind === "videoinput")
          constraints.video = {
            facingMode: "user",
          };
      });
    } catch (error) {
      showToast("در دریافت تصویر دوربین اشکالی ایجاد شده");
      let err = new Error("detect media device error");
      throw err;
    }
    try {
      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      myMediaStream.current = stream;
      myVideoRef.current.srcObject = stream;
      myVideoRef.current.setAttribute("playsinline", "");
      return stream;
    } catch (error) {
      throw error;
    }
  };
  const createRTC = async (phone) => {
    try {
      let stream = await getUserMedia();
      let rtc = new RTCPeerConnection(peerConnectionConfig);

      rtcConnection.current = rtc;

      const [vtrack] = stream.getVideoTracks();
      const [atrack] = stream.getAudioTracks();
      senderVideoStream.current = rtc.addTrack(vtrack, stream);
      senderAudioStream.current = rtc.addTrack(atrack, stream);

      rtc.onicecandidate = (event) => {
        if (event.candidate) {
          let msg = {
            name: phone,
            type: "candidate",
            candidate: event.candidate,
          };
          ws.current.send(JSON.stringify(msg));
        }
      };
      rtc.ontrack = (event) => {
        console.log("ON TRACK ", event.streams);
        remoteVideoRef.current.setAttribute("playsinline", "");
        remoteVideoRef.current.srcObject = event.streams[0];
        setWaitingForAccept(false);
        setCallingMode(true);
        setConnecting(false);
      };
      rtc.onconnectionstatechange = (ev) => {
        let msg = {
          token: localStorage.token,
          type: "call-state",
          state: rtc.connectionState,
        };
        rtcVonnectionState.current = rtc.connectionState;
        ws.current.send(JSON.stringify(msg));
      };
      rtc.ondatachannel = (event) => {
        console.log("ondatachannel", event);
        const { channel } = event;
        channel.binaryType = "arraybuffer";

        channel.onmessage = (event) => {
          console.log("ondatachannel onmessage >", event);
          const { data } = event;
          try {
            const blob = new Blob([data]);
            downloadFile(blob, channel.label);
            channel.close();
          } catch (err) {
            console.log("File transfer failed");
          }
        };
      };

      return rtc;
    } catch (error) {
      throw error;
    }
  };

  const handleAnswer = (answer) => {
    rtcConnection.current.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  };
  const handleCandidate = async (candidate) => {
    if (candidate)
      rtcConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
  };
  const sendOffer = async (cle) => {
    if (rtcConnection.current) {
      rtcConnection.current.close();
    }
    let destinationToken = cle;
    calleeName.current = destinationToken;
    try {
      let rtc = await createRTC(destinationToken);
      rtc
        .createOffer()
        .then(async (offer) => {
          await rtc.setLocalDescription(offer);
          let msg = {
            type: "offer",
            offer,
            token: localStorage.token,
            name: destinationToken,
          };
          ws.current.send(JSON.stringify(msg));
        })
        .catch(() => {
          showToast("خطا در ایجاد ارتباط");
        });
    } catch (error) {
      console.error(error);

      return;
    }
  };

  async function handleLogin(success, allUsers) {
    if (success === false) {
      localStorage.removeItem("token");
    } else {
      //successfull login.
    }
  }

  const handleLeave = () => {
    showToast("کاربر مکالمه را قطع کرد");

    setCallingMode(false);
    setConnecting(false);
    setWaitingForAccept(false);
    myMediaStream.current.getTracks().forEach((track) => track.stop());
    myMediaStream.current = null;
    rtcConnection.current.close();
    rtcConnection.current = null;
  };

  const handleInfo = (data) => {
    cid.current = data.cid;
    if (data.reset) {
      setCallingMode(false);
      setConnecting(false);
      setWaitingForAccept(false);
      myMediaStream.current.getTracks().forEach((track) => track.stop());
      myMediaStream.current = null;
    }
    if (data.calleeName) {
      calleeName.current = data.calleeName;
    }
  };
  const handleCallEnded = () => {
    showToast("مکالمه به پایان رسیده است");
    setCallingMode(false);
    setConnecting(false);
    setWaitingForAccept(false);
    myMediaStream.current.getTracks().forEach((track) => track.stop());
    myMediaStream.current = null;
  };

  const leaveCall = () => {
    showToast("مکالمه قطع شد");

    myMediaStream.current.getTracks().forEach((track) => track.stop());
    myMediaStream.current = null;
    rtcConnection.current.close();
    rtcConnection.current = null;
    setCallingMode(false);
    setConnecting(false);
    setWaitingForAccept(false);

    let msg = {
      name: calleeName.current,
      type: "leave",
      cid: cid.current,
    };
    ws.current.send(JSON.stringify(msg));
  };
  const handleWebsocketMessages = (message) => {
    console.log("received message :", message.data);
    if (message.data === "heartbeat") return;
    var data = JSON.parse(message.data);

    switch (data.type) {
      case "login":
        handleLogin(data.success, data.allUsers);
        break;

      case "offer":
        handleOffer(data.offer, data.name);
        break;

      case "answer":
        handleAnswer(data.answer);
        break;

      case "candidate":
        handleCandidate(data.candidate);
        break;

      case "call-to-user": {
        sendOffer(data.destination);
        cid.current = data.cid;
        break;
      }
      case "alert":
        showToast(data.text);
        break;
      case "leave":
        handleLeave();
        break;
      case "info":
        handleInfo(data);
        break;
      case "call-ended":
        handleCallEnded();
        break;
      default:
        break;
    }
  };
  const handleOffer = async (offer, callee) => {
    try {
      calleeName.current = callee;
      let rtc = await createRTC(callee);
      await rtc.setRemoteDescription(new RTCSessionDescription(offer));
      try {
        let answer = await rtc.createAnswer();
        await rtc.setLocalDescription(answer);
        let msg = {
          name: callee,
          type: "answer",
          answer,
        };
        ws.current.send(JSON.stringify(msg));
      } catch (error) {
        throw error;
      }
    } catch (error) {}
  };

  const requestSendSms = async (callee) => {
    let token = localStorage.token;
    let msg = {
      type: "send-sms",
      token,
      callee,
    };
    ws.current.send(JSON.stringify(msg));
    setWaitingForAccept(true);
    getUserMedia();
  };
  const shareFile = (e) => {
    let file = e.target.files[0];

    if (file) {
      const channelLabel = file.name;
      const channel = rtcConnection.current.createDataChannel(channelLabel);
      channel.binaryType = "arraybuffer";
      // channel.onopen = async () => {
      //   const arrayBuffer = await file.arrayBuffer();
      //   channel.send(arrayBuffer);
      //   setUploadingFile(true);
      // };
      channel.onerror = console.error;
      channel.onclose = (s) => {
        setUploadingFile(false);
      };
    }
  };

  const connectToWS = () => {
    let wsConnection = websocket();
    wsTry = 0;
    ws.current = wsConnection;

    wsConnection.onopen = async (e) => {
      clearTimeout(retryWsTimeout.current);
      let token = await getUserToken(wsConnection);
      setIsWSConnected(true);
      clearInterval(pingPong);

      if (callId && !cidSmsSent.current) {
        await getUserMedia();
        wsConnection.send(
          JSON.stringify({
            type: "sms-received",
            cid: callId,
            token,
          })
        );
        cidSmsSent.current = true;
      }

      pingPong = setInterval(() => {
        e.target.send("heartbeat");
      }, 10000);
    };
    wsConnection.onclose = () => {
      if (rtcConnection.current) {
        rtcConnection.current.close();
        rtcConnection.current = null;
      }

      clearInterval(pingPong);
      setIsWSConnected(false);
      retryWsTimeout.current = setTimeout(() => {
        connectToWS();
      }, 2000);

      setCallingMode(false);
      setConnecting(false);
    };
    wsConnection.onerror = () => {
      if (rtcConnection.current) {
        rtcConnection.current.close();
        rtcConnection.current = null;
      }
      showToast("ارتباط با سرور دچار خطا شده است");
      setCallingMode(false);
      setConnecting(false);
    };

    wsConnection.onmessage = handleWebsocketMessages; // eslint-disable-next-line
  };
  useEffect(() => {
    if (initialized) return;

    initialized = true;
    connectToWS();
  }, []);

  console.log("callingMode ", callingMode);
  return (
    <div className=" ">
      <div className="bg-main-container">
        <div className="bg-container">
          <img className="app-bg" src={`${process.env.PUBLIC_URL}/bg2.svg`} />
        </div>
      </div>

      <div className="app-main w-100 h-100">
        <div
          className="w-100 h-100"
          style={{ display: callingMode ? "none" : "inherit" }}
        >
          <Dial
            waitingForAccept={waitingForAccept}
            wsConnected={isWSConnected}
            sendOffer={requestSendSms}
            ws={ws}
          />
        </div>
      </div>

      <div
        className="connecting"
        style={{ display: connecting ? "flex" : "none" }}
      >
        در حال تماس ...
      </div>
      <div
        className="connecting"
        style={{ display: !isWSConnected ? "flex" : "none" }}
      >
        در حال اتصال به سرور ...
      </div>
      <div
        style={{ display: !callingMode ? "none" : "inherit" }}
        className="w-100 app-main video-call-page"
      >
        <div className="video-container">
          <video className="local-video" autoPlay ref={myVideoRef} muted />
          <video className="remote-video" autoPlay ref={remoteVideoRef} />
          <div className="panel-bar">
            <img
              onClick={leaveCall}
              className="leave-call-button"
              src={callEnd}
              alt=""
              width="30px"
              height="30px"
            />
            {/* <button
              className="send-file-button"
              onClick={() => browseFileRef.current.click()}
            >
              ارسال فایل{" "}
            </button> */}
          </div>
          {downloadigFile && <div>در حال دانلود فایل</div>}
          {uploadingFile && <div>در حال ارسال فایل</div>}
        </div>
      </div>
      <input onChange={shareFile} ref={browseFileRef} type="file" hidden />
      <Toast el={toastRef} text={toastText} />
    </div>
  );
}

export default App;
