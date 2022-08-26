import jwt from "jsonwebtoken";

const pricateKey =
  "z3b2v1s56ds96gjhk4l5bfdu41bd5r4ghb3x57g4po5qd1210h5h7hg1ng4g54g55";
export const getToken = (req, res) => {
  let username = `${Math.floor(Math.random() * 900) + 100}${Date.now()}`;
  var token = jwt.sign({ username, date: Date.now() }, pricateKey);
  res.json({ token });
};
