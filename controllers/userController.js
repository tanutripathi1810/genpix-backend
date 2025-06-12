import userModel from "../models/usermodel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import razorpay from "razorpay";
import transactionModel from "../models/transactionModel.js";

const registerUser = async (req, res) => {
    try{
        const {name,email,password}=req.body;
        if(!name || !email || !password){
            return res.json({message:"Please fill all the fields", success:false})
        }

        const salt=await bcrypt.genSalt(10);
        const hashedPassword=await bcrypt.hash(password,salt);

        const userData={
            name,
            email,
            password:hashedPassword
        }
        const newUser=new userModel(userData);
        const user=await newUser.save();

        const token=jwt.sign({id:user._id},process.env.JWT_SECRET)
        res.json({success:true,token,user:{name:user.name}})
    } catch(error){
        console.log(error);
        res.json({message:error.message, success:false})

    }

}

const loginUser = async (req, res) => {
    try{
        const {email,password}=req.body;
        const user=await userModel.findOne({email});
        if(!user){
            return res.json({message:"User not found", success:false})
        }
        const isMatch=await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.json({message:"Invalid credentials", success:false})
        }else{
            const token=jwt.sign({id:user._id},process.env.JWT_SECRET);
            res.json({success:true,token,user:{name:user.name}})
        }


    }
    catch(error){
        console.log(error);
        res.json({message:error.message, success:false})
    }
}

const userCredits = async(req, res) => {
    try{
        // Change this line from req.body.userId to req.user.id
        const userId = req.user.id;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({message: "User not found", success: false});
        }
        res.json({success:true, credits:user.creditBalance || 0, user:{name:user.name}})
    }catch(error){
        console.log(error);
        res.json({message:error.message, success:false})
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const payementRazorpay = async (req, res) => {
    try{
        const {planId}=req.body;
        const userId = req.user.id; // Get userId from req.user (set by middleware)
        const userData=await userModel.findById(userId);

        if(!userData || !planId){
            return res.json({json:false, message:"Invalid user or plan ID"})
        }
        let credits,plan,amount,dataLength
        switch (planId) {
            case 'Basic':
                plan='Basic'
                credits=100;
                amount=10; // 10.00 in rupees'
                
                break;
            case 'Advanced':
                plan='Advanced'
                credits=500;
                amount=50; // 10.00 in rupees'
                
                break;
            case 'Business':
                plan='Business'
                credits=5000;
                amount=250; // 10.00 in rupees'
                
                break;
            default:
                return res.json({json:false, message:"Invalid plan ID"})
        }
                
        const date=Date.now();
        const transactionData = {
            userId: userData._id,
            plan,
            credits,
            amount,
            date
        }

        const newTransaction=await transactionModel.create(transactionData);
        const options={
            amount: amount * 100, // Amount in paise
            currency: process.env.CURRENCY,
            receipt: newTransaction._id.toString()
        }
        await razorpayInstance.orders.create(options,(error,order)=>{
            if(error){
                console.log(error)
                res.json({json:false, message:error.message})
            }
            res.json({success:true, order})
        })


    }catch(error){
        console.log(error)
        res.json({json:false, message:error.message})
    }
}
const verifyRazorpay=async(req, res) => {
    try{
        const {razorpay_order_id} = req.body;
        const orderInfo=await razorpayInstance.orders.fetch(razorpay_order_id);

        if(orderInfo.status === 'paid'){
            const transactionData=await transactionModel.findById(orderInfo.receipt);
            if(transactionData.payment){
                return res.json({success:false, message:"Payment already verified"})
            }
            const userData=await userModel.findById(transactionData.userId);
            const creditBalance=userData.creditBalance+transactionData.credits;
            await userModel.findByIdAndUpdate(userData._id,{creditBalance});
            await transactionModel.findByIdAndUpdate(transactionData._id,{payment:true});
            res.json({success:true, message:"Payment verified successfully"})
            
        }
        else{
            res.json({success:false, message:"Payment not successful"})
        }
    }catch(error){
        console.log(error);
        res.json({message:error.message, success:false})
}}
export { registerUser, loginUser,userCredits,payementRazorpay,verifyRazorpay };