const {
  generateAccessToken,
  generateRefreshToken,
} = require("./generateTokens");
//sending tokens to frontend
const sendTokens = (user, res,type="user", statusCode = 200) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  res
    .status(statusCode)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
          authProvider: user?.authProvider,
  recentLogins: user?.recentLogins?.slice(0, 5), 

      },
    });
};

module.exports = sendTokens;
