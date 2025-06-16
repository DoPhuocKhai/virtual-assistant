const jwt = require('jsonwebtoken');

// Token generation
const generateTokens = (user) => {
    // Access token - short lived (15 minutes)
    const accessToken = jwt.sign(
        {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                department: user.department,
                position: user.position
            }
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    // Refresh token - long lived (7 days)
    const refreshToken = jwt.sign(
        {
            userId: user.id
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    return {
        accessToken,
        refreshToken
    };
};

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Token verification
const verifyToken = (token, isRefreshToken = false) => {
    try {
        const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateTokens,
    cookieOptions,
    verifyToken
};
