from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Set
from pydantic import BaseModel
import json
from datetime import datetime
import random
import asyncio
import math
# import csv
# import os
# from pathlib import Path
# from sqlalchemy import create_engine, Column, String, Boolean, Integer, Float, ForeignKey
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker, relationship

# Database setup
# SQLALCHEMY_DATABASE_URL = "sqlite:///./trading.db"
# engine = create_engine(SQLALCHEMY_DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()

# class Symbol(Base):
#     __tablename__ = "symbols"
# 
#     id = Column(Integer, primary_key=True, index=True)
#     symbol = Column(String, unique=True, index=True)
#     description = Column(String)
#     is_active = Column(Boolean, default=True)
#     created_at = Column(String, default=lambda: datetime.now().isoformat())
#     
#     # New fields for calculations
#     bid_edge_formula = Column(String, nullable=True)
#     ask_edge_formula = Column(String, nullable=True)
#     bid_q_formula = Column(String, nullable=True)
#     ask_q_formula = Column(String, nullable=True)
#     
#     # Relationships for dependencies
#     dependencies = relationship("SymbolDependency", back_populates="symbol")
# 
# class SymbolDependency(Base):
#     __tablename__ = "symbol_dependencies"
#     
#     id = Column(Integer, primary_key=True, index=True)
#     symbol_id = Column(Integer, ForeignKey("symbols.id"))
#     depends_on_id = Column(Integer, ForeignKey("symbols.id"))
#     
#     symbol = relationship("Symbol", back_populates="dependencies")
#     depends_on = relationship("Symbol")
# 
# # Create tables
# Base.metadata.create_all(bind=engine)

class Symbol:
    def __init__(self, symbol: str, description: Optional[str] = None):
        self.symbol = symbol
        self.description = description
        self.calculator = SymbolCalculator(symbol, description)
        self.setup_formulas()
    
    def setup_formulas(self):
        if self.symbol == "TYM5":
            self.calculator.set_formula("bid_edge", "0.5 * context['TYM5']['bid_edge'] + 0.5 * context['NQM5']['bid_edge'] - 0.3 * context['ESM5']['bid_edge']")
            self.calculator.set_formula("ask_edge", "0.5 * context['TYM5']['ask_edge'] + 0.5 * context['NQM5']['ask_edge'] - 0.3 * context['ESM5']['ask_edge']")
        elif self.symbol == "NQM5":
            # Add any NQM5 specific formulas here
            pass
        elif self.symbol == "ESM5":
            # Add any ESM5 specific formulas here
            pass
        elif self.symbol == "TUM5":
            # Add any TUM5 specific formulas here
            pass

class SymbolCalculator:
    def __init__(self, symbol: str, description: Optional[str] = None):
        self.symbol = symbol
        self.description = description
        self.bid_edge = -10
        self.ask_edge = -10
        self.bid_q = 0
        self.ask_q = 0
        self.maker = 'OFF'
        self.taker = 'OFF'
        self.overrides = {
            "bid_edge": {},
            "ask_edge": {},
            "bid_q": {},
            "ask_q": {},
            "maker": {},
            "taker": {}
        }
        self.dependencies = set()
        self.dependent_on = set()
        self.formulas = {
            "bid_edge": None,
            "ask_edge": None,
            "bid_q": None,
            "ask_q": None
        }
    
    def add_dependency(self, other_symbol: 'SymbolCalculator'):
        self.dependencies.add(other_symbol)
        other_symbol.dependent_on.add(self)
    
    def remove_dependency(self, other_symbol: 'SymbolCalculator'):
        self.dependencies.discard(other_symbol)
        other_symbol.dependent_on.discard(self)
    
    def set_formula(self, field: str, formula: str):
        if field in self.formulas:
            self.formulas[field] = formula
    
    def calculate_value(self, field: str, time_diff: float, symbol_seed: int) -> float:
        """Calculate a new value for a field based on its formula or default behavior"""
        try:
            if field in self.formulas:
                # Use the formula to calculate the value
                formula = self.formulas[field]
                # Create a namespace for evaluation with all required variables
                namespace = {
                    'math': math,
                    'time_diff': time_diff,
                    'symbol_seed': symbol_seed,
                    'bid_edge': self.bid_edge,
                    'ask_edge': self.ask_edge,
                    'bid_q': self.bid_q,
                    'ask_q': self.ask_q
                }
                print(f"\nCalculating {field} with formula: {formula}")
                print(f"Current values: bid_edge={self.bid_edge}, ask_edge={self.ask_edge}, bid_q={self.bid_q}, ask_q={self.ask_q}")
                value = eval(formula, namespace)
                print(f"Calculated value: {value}")
            else:
                # Default behavior for fields without formulas
                if field in ["bid_edge", "ask_edge"]:
                    # For edge fields, use a random walk with mean reversion
                    current_value = getattr(self, field)
                    # Random walk component
                    random_walk = random.uniform(-0.1, 0.1)
                    # Mean reversion component (pull towards 100)
                    mean_reversion = (100 - current_value) * 0.01
                    # Combine components
                    value = current_value + random_walk + mean_reversion
                    print(f"\nCalculating {field} with random walk:")
                    print(f"Current value: {current_value}")
                    print(f"Random walk: {random_walk}")
                    print(f"Mean reversion: {mean_reversion}")
                    print(f"Final value: {value}")
                else:
                    # For quantity fields, use a random walk with bounds
                    current_value = getattr(self, field)
                    # Random walk with bounds
                    value = current_value + random.uniform(-1, 1)
                    # Ensure value stays within bounds
                    value = max(1, min(100, value))
                    print(f"\nCalculating {field} with random walk:")
                    print(f"Current value: {current_value}")
                    print(f"Final value: {value}")
            
            # Apply rounding based on field type
            if field in ["bid_edge", "ask_edge"]:
                value = round(value, 2)  # Round edges to 2 decimal places
            else:
                value = round(value)  # Round quantities to whole numbers
            
            return value
        except Exception as e:
            print(f"Error calculating {field}: {str(e)}")
            # If there's an error, use a default calculation
            if field in ["bid_edge", "ask_edge"]:
                return round(100 + random.uniform(-1, 1), 2)
            else:
                return round(random.uniform(1, 100))

    def get_cell_data(self) -> Dict:
        return {
            symbol: {
                "bid_edge": {"value": calc.calculator.bid_edge, "overrides": calc.calculator.overrides["bid_edge"]},
                "ask_edge": {"value": calc.calculator.ask_edge, "overrides": calc.calculator.overrides["ask_edge"]},
                "bid_q": {"value": calc.calculator.bid_q, "overrides": calc.calculator.overrides["bid_q"]},
                "ask_q": {"value": calc.calculator.ask_q, "overrides": calc.calculator.overrides["ask_q"]},
                "maker": {"value": calc.calculator.maker, "overrides": calc.calculator.overrides["maker"]},
                "taker": {"value": calc.calculator.taker, "overrides": calc.calculator.overrides["taker"]}
            }
            for symbol, calc in self.symbols.items()
        }

# Create logs directory if it doesn't exist
# LOGS_DIR = Path("logs")
# LOGS_DIR.mkdir(exist_ok=True)

# class ValueLogger:
#     def __init__(self):
#         self.log_file = LOGS_DIR / f"trading_values_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
#         self.fieldnames = ['timestamp', 'symbol', 'field', 'value', 'is_override', 'user_id']
#         self._initialize_log_file()
    
#     def _initialize_log_file(self):
#         with open(self.log_file, 'w', newline='') as f:
#             writer = csv.DictWriter(f, fieldnames=self.fieldnames)
#             writer.writeheader()
    
#     def log_value(self, timestamp: datetime, symbol: str, field: str, value: float, is_override: bool, user_id: Optional[str] = None):
#         with open(self.log_file, 'a', newline='') as f:
#             writer = csv.DictWriter(f, fieldnames=self.fieldnames)
#             writer.writerow({
#                 'timestamp': timestamp.isoformat(),
#                 'symbol': symbol,
#                 'field': field,
#                 'value': value,
#                 'is_override': str(is_override),
#                 'user_id': user_id
#             })

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.symbols: Dict[str, Symbol] = {}
        self.last_update = datetime.now()
        self.column_orders = {}
        self.symbol_orders = {}
        self.master_maker = 'OFF'  # Add master maker state
        self.master_taker = 'OFF'  # Add master taker state
        # self.value_logger = ValueLogger()
        self.initialize_symbols()

    def initialize_symbols(self):
        # Initialize symbols as proper objects
        symbol_classes = {
            "TYM5": Symbol("TYM5", "30-Year Treasury Bond"),
            "NQM5": Symbol("NQM5", "Nasdaq-100 E-mini"),
            "ESM5": Symbol("ESM5", "E-mini S&P 500"),
            "TUM5": Symbol("TUM5", "2-Year Treasury Note")
        }
        
        # Add all symbols to the manager
        for symbol in symbol_classes.values():
            self.symbols[symbol.symbol] = symbol
            # Clear all overrides for this symbol
            for field in symbol.calculator.overrides:
                symbol.calculator.overrides[field] = {}
            
        # Set up dependencies between symbols
        if "TYM5" in self.symbols and "NQM5" in self.symbols and "ESM5" in self.symbols:
            self.symbols["TYM5"].calculator.add_dependency(self.symbols["NQM5"].calculator)
            self.symbols["TYM5"].calculator.add_dependency(self.symbols["ESM5"].calculator)

    def get_cell_data(self) -> Dict:
        return {
            symbol: {
                "bid_edge": {"value": calc.calculator.bid_edge, "overrides": calc.calculator.overrides["bid_edge"]},
                "ask_edge": {"value": calc.calculator.ask_edge, "overrides": calc.calculator.overrides["ask_edge"]},
                "bid_q": {"value": calc.calculator.bid_q, "overrides": calc.calculator.overrides["bid_q"]},
                "ask_q": {"value": calc.calculator.ask_q, "overrides": calc.calculator.overrides["ask_q"]},
                "maker": {"value": calc.calculator.maker, "overrides": calc.calculator.overrides["maker"]},
                "taker": {"value": calc.calculator.taker, "overrides": calc.calculator.overrides["taker"]}
            }
            for symbol, calc in self.symbols.items()
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await websocket.send_json({
            "type": "initial_data",
            "cell_data": self.get_cell_data(),
            "column_orders": self.column_orders,
            "symbol_orders": self.symbol_orders
        })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

    async def update_values(self):
        while True:
            current_time = datetime.now()
            time_diff = (current_time - self.last_update).total_seconds()
            
            # Update all symbols
            for symbol in self.symbols.values():
                symbol_seed = sum(ord(c) for c in symbol.symbol)
                
                # Calculate new values
                symbol.calculator.bid_edge = symbol.calculator.calculate_value("bid_edge", time_diff, symbol_seed)
                symbol.calculator.ask_edge = symbol.calculator.calculate_value("ask_edge", time_diff, symbol_seed)
                symbol.calculator.bid_q = symbol.calculator.calculate_value("bid_q", time_diff, symbol_seed)
                symbol.calculator.ask_q = symbol.calculator.calculate_value("ask_q", time_diff, symbol_seed)
                
                # # Log calculated values
                # self.value_logger.log_value(current_time, symbol.symbol, "bid_edge", symbol.calculator.bid_edge, False)
                # self.value_logger.log_value(current_time, symbol.symbol, "ask_edge", symbol.calculator.ask_edge, False)
                # self.value_logger.log_value(current_time, symbol.symbol, "bid_q", symbol.calculator.bid_q, False)
                # self.value_logger.log_value(current_time, symbol.symbol, "ask_q", symbol.calculator.ask_q, False)
                
                # # Log any overrides
                # for field in ["bid_edge", "ask_edge", "bid_q", "ask_q"]:
                #     for user_id, override in symbol.calculator.overrides[field].items():
                #         self.value_logger.log_value(
                #             current_time,
                #             symbol.symbol,
                #             field,
                #             override["value"],
                #             True,
                #             user_id
                #         )
            
            # Print debug info for bid edges
            print("\nCurrent bid edges:")
            for symbol in self.symbols.values():
                print(f"{symbol.symbol}: {symbol.calculator.bid_edge}")
            
            await self.broadcast({
                "type": "cell_update",
                "cell_data": self.get_cell_data()
            })
            await asyncio.sleep(1)

    def update_column_order(self, user_id: str, order: List[str]):
        self.column_orders[user_id] = order
        asyncio.create_task(self.broadcast({
            "type": "column_order_update",
            "user_id": user_id,
            "order": order
        }))

    def update_symbol_order(self, user_id: str, order: List[str]):
        self.symbol_orders[user_id] = order
        asyncio.create_task(self.broadcast({
            "type": "symbol_order_update",
            "user_id": user_id,
            "order": order
        }))

    def add_symbol(self, symbol: str, description: Optional[str] = None):
        if symbol in self.symbols:
            raise HTTPException(status_code=400, detail="Symbol already exists")
        
        # Create new symbol instance
        new_symbol = Symbol(symbol, description)
        self.symbols[symbol] = new_symbol

        asyncio.create_task(self.broadcast({
            "type": "symbol_added",
            "symbol": symbol,
            "description": description
        }))

    def update_cell(self, symbol: str, cell_id: str, value: Optional[float], user_id: str):
        if symbol in self.symbols:
            calculator = self.symbols[symbol].calculator
            if cell_id in calculator.overrides:
                current_time = datetime.now()
                # If value is None or empty string, remove the override completely
                if value is None or value == "":
                    if user_id in calculator.overrides[cell_id]:
                        del calculator.overrides[cell_id][user_id]
                        # If no more overrides, reset to calculated value
                        if not calculator.overrides[cell_id]:
                            time_diff = (current_time - self.last_update).total_seconds()
                            symbol_seed = sum(ord(c) for c in symbol)
                            new_value = calculator.calculate_value(cell_id, time_diff, symbol_seed)
                            setattr(calculator, cell_id, new_value)
                            calculator.overrides[cell_id] = {}
                else:
                    # Handle toggles as strings
                    if cell_id in ["maker", "taker"]:
                        if value in ["ON", "OFF"]:
                            calculator.overrides[cell_id][user_id] = {
                                "value": value,
                                "timestamp": current_time.isoformat()
                            }
                            setattr(calculator, cell_id, value)
                        else:
                            # Remove override if value is not valid
                            if user_id in calculator.overrides[cell_id]:
                                del calculator.overrides[cell_id][user_id]
                                if not calculator.overrides[cell_id]:
                                    calculator.overrides[cell_id] = {}
                    else:
                        try:
                            float_value = float(value)
                            calculator.overrides[cell_id][user_id] = {
                                "value": float_value,
                                "timestamp": current_time.isoformat()
                            }
                            setattr(calculator, cell_id, float_value)
                        except (ValueError, TypeError):
                            if user_id in calculator.overrides[cell_id]:
                                del calculator.overrides[cell_id][user_id]
                                if not calculator.overrides[cell_id]:
                                    calculator.overrides[cell_id] = {}
                return True
        return False

    async def broadcast_master_state(self):
        await self.broadcast({
            "type": "master_state_update",
            "master_maker": self.master_maker,
            "master_taker": self.master_taker
        })

    def set_master_state(self, maker=None, taker=None):
        if maker is not None:
            self.master_maker = maker
        if taker is not None:
            self.master_taker = taker
        asyncio.create_task(self.broadcast_master_state())

manager = ConnectionManager()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ColumnOrder(BaseModel):
    user_id: str
    order: List[str]

class SymbolOrder(BaseModel):
    user_id: str
    order: List[str]

class NewSymbol(BaseModel):
    symbol: str
    description: Optional[str] = None

class CellUpdate(BaseModel):
    cell_id: str
    value: Optional[float] = None  # Make value optional to support override removal
    user_id: str
    symbol: str

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            update_data = json.loads(data)
            
            if update_data.get("type") == "column_order":
                manager.update_column_order(
                    update_data["user_id"],
                    update_data["order"]
                )
            elif update_data.get("type") == "symbol_order":
                manager.update_symbol_order(
                    update_data["user_id"],
                    update_data["order"]
                )
            elif update_data.get("type") == "master_state":
                maker = update_data.get("master_maker")
                taker = update_data.get("master_taker")
                manager.set_master_state(maker, taker)
            else:
                cell_id = update_data["cell_id"]
                value = update_data.get("value")  # Use get() to handle None or empty values
                user_id = update_data["user_id"]
                symbol = update_data["symbol"]
                
                manager.update_cell(symbol, cell_id, value, user_id)
                
                await manager.broadcast({
                    "type": "cell_update",
                    "cell_data": manager.get_cell_data()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/cells")
async def get_cells():
    return {
        "cell_data": manager.get_cell_data(),
        "column_orders": manager.column_orders,
        "symbol_orders": manager.symbol_orders
    }

@app.get("/symbols")
async def get_symbols():
    return [{"symbol": symbol, "description": calc.description} 
            for symbol, calc in manager.symbols.items()]

@app.post("/symbols")
async def add_symbol(symbol: NewSymbol):
    manager.add_symbol(symbol.symbol, symbol.description)
    return {"status": "success", "symbol": symbol.symbol}

@app.post("/cells/{symbol}/{cell_id}")
async def update_cell(symbol: str, cell_id: str, update: CellUpdate):
    if manager.update_cell(symbol, cell_id, update.value, update.user_id):
        await manager.broadcast({
            "type": "cell_update",
            "cell_data": manager.get_cell_data()
        })
        return {"status": "success"}
    return {"status": "error", "message": "Cell not found"}

@app.post("/column-order")
async def update_column_order(order_update: ColumnOrder):
    manager.update_column_order(order_update.user_id, order_update.order)
    return {"status": "success"}

@app.post("/symbol-order")
async def update_symbol_order(order_update: SymbolOrder):
    manager.update_symbol_order(order_update.user_id, order_update.order)
    return {"status": "success"}

@app.get("/master-state")
async def get_master_state():
    return {
        "master_maker": manager.master_maker,
        "master_taker": manager.master_taker
    }

@app.post("/master-state")
async def set_master_state(data: dict):
    maker = data.get("master_maker")
    taker = data.get("master_taker")
    manager.set_master_state(maker, taker)
    return {"status": "success"}

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(manager.update_values())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 