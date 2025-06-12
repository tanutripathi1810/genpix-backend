import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
    const {token} = req.headers;
    if(!token){
        return res.status(401).json({message:"No token provided", success:false});
    }
    
    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if(tokenDecode.id){
            // Use req.user instead of req.body.userId
            req.user = { id: tokenDecode.id };
            next();
        }
        else{
            return res.status(401).json({message:"Invalid token structure", success:false});
        }
    } catch (error) {
        return res.status(401).json({message:"Token verification failed: " + error.message, success:false});
    }
};

export default userAuth;