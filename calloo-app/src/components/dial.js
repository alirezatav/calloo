import React, { useState } from "react";
import logo from "../assets/logo1.png";
import "./index.scss";
import callIcon from '../assets/call.svg'


const Dial = (props) => {
  const [phone, setPhone] = useState("");

  return (
    <div className="dial-page d-flex flex-column justify-content-center align-items-center">
      <div className="dial-page-logo d-flex justify-content-center  ">
        <img src={logo} alt="" width="30%" />
      </div>
      <div className="container">
        <div className="text text-center mt-5">
          شماره موبایل کاربر مورد نظر را وارد نمایید
        </div>
        <div className="dial-input pr-4 pl-4">
          <input
            type="tel"
            placeholder="مثلا 09121234567"
            onChange={(e) => {
              let value = e.target.value;
              let isMatch = value.length < 12;
              if (isMatch) setPhone(e.target.value);
              setPhone(e.target.value);
            }}
            value={phone}
          />
        </div>
        <div className="d-flex justify-content-center  dial-button  ">
          <button
            onClick={() => {
              let isMatch = phone.match(/^09[0|1|2|3][0-9]{8}$/);
              // if (!isMatch) {
              //   alert("wrong mobile number");
              //   return;
              // }
              props.sendOffer(phone);
            }}
            className="call-button"
          >
            <img alt="" src={callIcon} width="30px"/>
            {/* {!props.isSmsSent ? "درخواست تماس" : "ارسال شد"} */}
          </button>{" "}
        </div>
      </div>
    </div>
  );
};
export default Dial;
