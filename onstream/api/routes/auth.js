const router = require("express").Router();
const User = require("../models/User");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { parseUserAgent, describeDevice } = require("../services/deviceInfo");

/**
 * Records a successful sign-in.
 *
 * `$slice: -50` caps the array: login history is only ever read as "the last
 * few sessions", and an uncapped push grows the User document forever for
 * anyone who logs in daily — the same unbounded-array trap the watch stores
 * were built to avoid.
 */
function recordLogin(userId, req) {
  const device = parseUserAgent(req.headers["user-agent"]);
  return User.updateOne(
    { _id: userId },
    {
      $set: { lastLoginDate: new Date() },
      $push: {
        loginHistory: {
          $each: [
            {
              date: new Date(),
              device: describeDevice(device),
              // Set by the CDN/proxy when there is one; blank rather than a
              // guessed value so the UI can tell "unknown" from "nowhere".
              location: String(
                req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || ""
              ).slice(0, 8),
            },
          ],
          $slice: -50,
        },
      },
    }
  );
}

//REGISTER
router.post("/register", async (req, res) => {
  const newUser = new User({
    username: req.body.username,
    email: req.body.email,
    password: CryptoJS.AES.encrypt(
      req.body.password,
      process.env.SECRET_KEY
    ).toString(),
  });
  try {
    const user = await newUser.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json(err);
  }
});

//LOGIN
router.post("/login", async (req, res) => {
  try {
    console.log('Login attempt for email:', req.body.email);
    
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ message: "Wrong password or username!" });
    }

    console.log('User found:', { id: user._id, isAdmin: user.isAdmin });
    
    const bytes = CryptoJS.AES.decrypt(user.password, process.env.SECRET_KEY);
    const originalPassword = bytes.toString(CryptoJS.enc.Utf8);

    if (originalPassword !== req.body.password) {
      console.log('Password mismatch');
      return res.status(401).json({ message: "Wrong password or username!" });
    }

    const accessToken = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin },
      process.env.SECRET_KEY,
      { expiresIn: "5d" }
    );

    console.log('Generated token:', accessToken.substring(0, 20) + '...');

    // Awaited: the profile page reads lastLoginDate, and a fire-and-forget
    // write here loses the very first login of every new account to the race
    // against the redirect that follows this response.
    await recordLogin(user._id, req);

    const { password, ...info } = user._doc;

    res.status(200).json({ ...info, accessToken, lastLoginDate: new Date() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json(err);
  }
});

module.exports = router;
