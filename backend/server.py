from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import uuid
from datetime import datetime
import hashlib
import hmac

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import razorpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["https://undiyu-2.vercel.app"],  # change this to your frontend URL in production
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

razorpay_client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID"),
    os.getenv("RAZORPAY_KEY_SECRET")
))

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Payment Models
class CartItem(BaseModel):
    id: str
    title: str
    quantity: int
    price: float
    handle: str

class CreateOrderRequest(BaseModel):
    amount: int  # Amount in paise
    currency: str
    cart: List[CartItem]

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    cart: List[CartItem]

class OrderResponse(BaseModel):
    id: str
    amount: int
    currency: str
    status: str

class PaymentVerificationResponse(BaseModel):
    success: bool
    message: str
    order_id: str = None

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Payment endpoints for e-commerce functionality
# @api_router.post("/create-razorpay-order", response_model=OrderResponse)
# async def create_razorpay_order(request: CreateOrderRequest):
#     """
#     Create a Razorpay order for payment processing
#     Note: This is a mock implementation for development. 
#     For production, you would integrate with actual Razorpay API.
#     """
#     try:
#         # Generate a mock order ID
#         order_id = f"order_{uuid.uuid4().hex[:12]}"
        
#         # Store order in database
#         order_data = {
#             "id": order_id,
#             "amount": request.amount,
#             "currency": request.currency,
#             "cart": [item.dict() for item in request.cart],
#             "status": "created",
#             "created_at": datetime.utcnow()
#         }
        
#         await db.orders.insert_one(order_data)
        
#         # Return mock Razorpay order response
#         return OrderResponse(
#             id=order_id,
#             amount=request.amount,
#             currency=request.currency,
#             status="created"
#         )
        
#     except Exception as e:
#         logging.error(f"Error creating order: {str(e)}")
#         raise HTTPException(status_code=500, detail="Failed to create order")

@api_router.post("/verify-payment", response_model=PaymentVerificationResponse)
async def verify_payment(request: VerifyPaymentRequest):
    """
    Verify Razorpay payment signature and process the order
    Note: This is a mock implementation for development.
    For production, you would verify the actual Razorpay signature.
    """
    try:
        # In production, you would verify the signature using Razorpay secret
        # signature = hmac.new(
        #     razorpay_secret.encode(),
        #     f"{request.razorpay_order_id}|{request.razorpay_payment_id}".encode(),
        #     hashlib.sha256
        # ).hexdigest()
        
        # For development, we'll assume payment is successful
        # Find the order in database
        order = await db.orders.find_one({"id": request.razorpay_order_id})
        
        if not order:
            return PaymentVerificationResponse(
                success=False,
                message="Order not found"
            )
        
        # Update order status
        await db.orders.update_one(
            {"id": request.razorpay_order_id},
            {
                "$set": {
                    "status": "paid",
                    "payment_id": request.razorpay_payment_id,
                    "paid_at": datetime.utcnow()
                }
            }
        )
        
        # Store payment record
        payment_record = {
            "id": str(uuid.uuid4()),
            "order_id": request.razorpay_order_id,
            "payment_id": request.razorpay_payment_id,
            "signature": request.razorpay_signature,
            "cart": [item.dict() for item in request.cart],
            "status": "verified",
            "created_at": datetime.utcnow()
        }
        
        await db.payments.insert_one(payment_record)
        
        return PaymentVerificationResponse(
            success=True,
            message="Payment verified successfully",
            order_id=request.razorpay_order_id
        )
        
    except Exception as e:
        logging.error(f"Error verifying payment: {str(e)}")
        return PaymentVerificationResponse(
            success=False,
            message="Payment verification failed"
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()



@api_router.post("/create-razorpay-order")
async def create_razorpay_order(request: Request):
    try:
        data = await request.json()
        print("Received data:", data)

        amount = int(data.get("amount"))
        currency = data.get("currency", "INR")

        order = razorpay_client.order.create({
            "amount": amount,
            "currency": currency,
            "receipt": f"receipt_{os.urandom(4).hex()}"
        })

        return order
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# @app.post("/api/create-razorpay-order")
# async def create_razorpay_order(request: Request):
#     try:
#         data = await request.json()
#         print("Received data:", data)  # ✅ Add this line here

#         amount = int(data.get("amount"))
#         currency = data.get("currency", "INR")

#         order = razorpay_client.order.create({
#             "amount": amount,
#             "currency": currency,
#             "receipt": f"receipt_{os.urandom(4).hex()}"
#         })

#         return order
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))