import React, { useEffect, useState, useRef } from "react";
import "./toast.scss";

const Toast = (props) => {
 
  return (
    <div ref={props.el} className={`toast`}>
      <div className="desc">{props.text}</div>
    </div>
  );
};
export default Toast;
