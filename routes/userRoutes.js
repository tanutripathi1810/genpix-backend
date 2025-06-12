import express from 'express';
import {registerUser, loginUser, userCredits, payementRazorpay, verifyRazorpay} from '../controllers/userController.js';
import userAuth from '../middlewares/auth.js';

const userRouter = express.Router();
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.get('/credits',userAuth, userCredits)
userRouter.post('/pay-razor', userAuth,payementRazorpay);
userRouter.post('/verify-razor',userAuth, verifyRazorpay);
export default userRouter;

