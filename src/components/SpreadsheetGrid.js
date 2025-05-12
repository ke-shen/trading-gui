import React, { useState, useEffect, useRef } from 'react';
import './SpreadsheetGrid.css';

const SpreadsheetGrid = () => {
    const defaultSymbols = ['ESM5', 'NQM5', 'TYM5', 'TUM5'];
    const defaultColumns = [
        { id: 'bid_edge', label: 'Bid Edge', editable: false },
        { id: 'bid_edge_override', label: 'Bid Edge Override', editable: true },
        { id: 'ask_edge', label: 'Ask Edge', editable: false },
        { id: 'ask_edge_override', label: 'Ask Edge Override', editable: true },
        { id: 'bid_q', label: 'Bid Qty', editable: false },
        { id: 'bid_q_override', label: 'Bid Qty Override', editable: true },
        { id: 'ask_q', label: 'Ask Qty', editable: false },
        { id: 'ask_q_override', label: 'Ask Qty Override', editable: true },
        { id: 'maker', label: 'Maker', type: 'toggle', editable: true },
        { id: 'taker', label: 'Taker', type: 'toggle', editable: true }
    ];

    const [columns, setColumns] = useState(defaultColumns);
    const [symbols, setSymbols] = useState(defaultSymbols);
    const [cells, setCells] = useState({});
    const [selectedCell, setSelectedCell] = useState('bid_edge');
    const [selectedSymbol, setSelectedSymbol] = useState('ESM5');
    const [isCellFocused, setIsCellFocused] = useState(false);
    const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);
    const [draggedColumn, setDraggedColumn] = useState(null);
    const [draggedSymbol, setDraggedSymbol] = useState(null);
    const ws = useRef(null);
    const inputRef = useRef(null);
    const [masterMaker, setMasterMaker] = useState('ON');
    const [masterTaker, setMasterTaker] = useState('ON');

    useEffect(() => {
        console.log('Connecting to WebSocket...');
        ws.current = new WebSocket('ws://localhost:8000/ws');

        ws.current.onopen = () => {
            console.log('WebSocket connected');
        };

        ws.current.onmessage = (event) => {
            console.log('Received message:', event.data);
            const data = JSON.parse(event.data);
            
            if (data.type === 'initial_data') {
                setCells(data.cell_data);
                if (data.column_orders && data.column_orders[userId]) {
                    const orderedColumns = data.column_orders[userId].map(id => 
                        defaultColumns.find(col => col.id === id)
                    ).filter(Boolean);
                    if (orderedColumns.length === defaultColumns.length) {
                        setColumns(orderedColumns);
                    }
                }
                if (data.symbol_orders && data.symbol_orders[userId]) {
                    const orderedSymbols = data.symbol_orders[userId].filter(symbol => 
                        defaultSymbols.includes(symbol)
                    );
                    if (orderedSymbols.length === defaultSymbols.length) {
                        setSymbols(orderedSymbols);
                    }
                }
            } else if (data.type === 'cell_update') {
                setCells(data.cell_data);
            } else if (data.type === 'column_order_update') {
                if (data.user_id === userId) {
                    const orderedColumns = data.order.map(id => 
                        defaultColumns.find(col => col.id === id)
                    ).filter(Boolean);
                    if (orderedColumns.length === defaultColumns.length) {
                        setColumns(orderedColumns);
                    }
                }
            } else if (data.type === 'symbol_order_update') {
                if (data.user_id === userId) {
                    const orderedSymbols = data.order.filter(symbol => 
                        defaultSymbols.includes(symbol)
                    );
                    if (orderedSymbols.length === defaultSymbols.length) {
                        setSymbols(orderedSymbols);
                    }
                }
            } else if (data.type === 'master_state_update') {
                if (typeof data.master_maker !== 'undefined') setMasterMaker(data.master_maker);
                if (typeof data.master_taker !== 'undefined') setMasterTaker(data.master_taker);
            }
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.current.onclose = () => {
            console.log('WebSocket disconnected');
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [userId]);

    const handleKeyDown = (e) => {
        // Only include editable columns for navigation
        const editableColumns = columns.filter(col => col.editable !== false);
        const currentColIndex = editableColumns.findIndex(col => col.id === selectedCell);
        const currentSymbolIndex = symbols.indexOf(selectedSymbol);
        const column = columns.find(col => col.id === selectedCell);

        // Allow native input for numbers/decimals
        if (/^[0-9.]$/.test(e.key) && column?.editable !== false && !column?.type) {
            setIsCellFocused(true);
            if (inputRef.current) {
                inputRef.current.focus();
            }
            return;
        }

        // Navigation and toggles
        switch (e.key) {
            case 'Tab':
            case 'ArrowRight':
                e.preventDefault();
                if (currentColIndex < editableColumns.length - 1) {
                    setSelectedCell(editableColumns[currentColIndex + 1].id);
                    setIsCellFocused(false);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (currentColIndex > 0) {
                    setSelectedCell(editableColumns[currentColIndex - 1].id);
                    setIsCellFocused(false);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentSymbolIndex > 0) {
                    setSelectedSymbol(symbols[currentSymbolIndex - 1]);
                    setIsCellFocused(false);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentSymbolIndex < symbols.length - 1) {
                    setSelectedSymbol(symbols[currentSymbolIndex + 1]);
                    setIsCellFocused(false);
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (column?.type === 'toggle') {
                    // Toggle the value
                    const cell = cells[selectedSymbol]?.[selectedCell];
                    const currentValue = cell?.value === 'ON' ? 'ON' : 'OFF';
                    const newValue = currentValue === 'ON' ? 'OFF' : 'ON';
                    handleCellChange(selectedCell, newValue, selectedSymbol);
                } else {
                    setIsCellFocused(false);
                    if (inputRef.current) {
                        inputRef.current.blur();
                    }
                }
                break;
            case ' ': // Spacebar should also toggle
                if (column?.type === 'toggle') {
                    e.preventDefault();
                    const cell = cells[selectedSymbol]?.[selectedCell];
                    const currentValue = cell?.value === 'ON' ? 'ON' : 'OFF';
                    const newValue = currentValue === 'ON' ? 'OFF' : 'ON';
                    handleCellChange(selectedCell, newValue, selectedSymbol);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsCellFocused(false);
                if (inputRef.current) {
                    inputRef.current.blur();
                }
                break;
            default:
                break;
        }
    };

    const handleCellChange = (cellId, value, symbol, isOverride = false) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const baseCellId = cellId.replace('_override', '');
            const column = columns.find(col => col.id === cellId);
            
            const message = {
                cell_id: baseCellId,
                value: column?.type === 'toggle' ? value : (value === '' ? null : parseFloat(value)),
                user_id: userId,
                symbol: symbol
            };
            console.log('Sending message:', message);
            ws.current.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    };

    const handleColumnDragStart = (e, columnId) => {
        setDraggedColumn(columnId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleSymbolDragStart = (e, symbol) => {
        setDraggedSymbol(symbol);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleColumnDrop = (e, targetColumnId) => {
        e.preventDefault();
        if (draggedColumn && draggedColumn !== targetColumnId) {
            const newColumns = [...columns];
            const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
            const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);
            
            const [draggedItem] = newColumns.splice(draggedIndex, 1);
            newColumns.splice(targetIndex, 0, draggedItem);
            
            setColumns(newColumns);
            
            // Send new column order to server
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'column_order',
                    user_id: userId,
                    order: newColumns.map(col => col.id)
                };
                ws.current.send(JSON.stringify(message));
            }
        }
        setDraggedColumn(null);
    };

    const handleSymbolDrop = (e, targetSymbol) => {
        e.preventDefault();
        if (draggedSymbol && draggedSymbol !== targetSymbol) {
            const newSymbols = [...symbols];
            const draggedIndex = newSymbols.indexOf(draggedSymbol);
            const targetIndex = newSymbols.indexOf(targetSymbol);
            
            const [draggedItem] = newSymbols.splice(draggedIndex, 1);
            newSymbols.splice(targetIndex, 0, draggedItem);
            
            setSymbols(newSymbols);
            
            // Send new symbol order to server
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'symbol_order',
                    user_id: userId,
                    order: newSymbols
                };
                ws.current.send(JSON.stringify(message));
            }
        }
        setDraggedSymbol(null);
    };

    const handleMasterToggle = (type) => {
        let newValue;
        if (type === 'maker') {
            newValue = masterMaker === 'ON' ? 'OFF' : 'ON';
            setMasterMaker(newValue);
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'master_state', master_maker: newValue }));
            }
        } else if (type === 'taker') {
            newValue = masterTaker === 'ON' ? 'OFF' : 'ON';
            setMasterTaker(newValue);
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: 'master_state', master_taker: newValue }));
            }
        }
    };

    const renderMasterControls = () => {
        return (
            <div className="master-controls">
                <div className="master-control">
                    <span className="master-label">Master Maker:</span>
                    <button
                        className={`toggle-button ${masterMaker === 'ON' ? 'on' : 'off'}`}
                        onClick={() => handleMasterToggle('maker')}
                    >
                        {masterMaker}
                    </button>
                </div>
                <div className="master-control">
                    <span className="master-label">Master Taker:</span>
                    <button
                        className={`toggle-button ${masterTaker === 'ON' ? 'on' : 'off'}`}
                        onClick={() => handleMasterToggle('taker')}
                    >
                        {masterTaker}
                    </button>
                </div>
            </div>
        );
    };

    const renderCell = (cellId, symbol, isOverride = false) => {
        const baseCellId = cellId.replace('_override', '');
        const cell = cells[symbol]?.[baseCellId];
        const isSelected = selectedCell === cellId && selectedSymbol === symbol;
        const userOverride = cell?.overrides?.[userId];
        const column = columns.find(col => col.id === cellId);
        
        let value;
        if (column?.type === 'toggle') {
            // Master logic: if master is OFF, force ON and disable
            if ((cellId === 'maker' && masterMaker === 'OFF') || (cellId === 'taker' && masterTaker === 'OFF')) {
                value = 'ON';
            } else {
                value = cell?.value === 'ON' ? 'ON' : 'OFF';
            }
        } else {
            value = isOverride 
                ? (userOverride ? userOverride.value : '')
                : (userOverride ? userOverride.value : cell?.value);
        }

        // Get other users' overrides
        const otherOverrides = Object.entries(cell?.overrides || {})
            .filter(([id]) => id !== userId);

        // Render formula-based (non-editable) cells as plain text
        if (column?.editable === false && !column?.type) {
            return (
                <div
                    key={`${symbol}-${cellId}`}
                    className={`cell read-only ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                        setSelectedCell(cellId);
                        setSelectedSymbol(symbol);
                    }}
                >
                    {value}
                </div>
            );
        }

        return (
            <div
                key={`${symbol}-${cellId}`}
                className={`cell ${isSelected ? 'selected' : ''} ${column?.type === 'toggle' ? 'toggle-cell' : ''}`}
                onClick={() => {
                    setSelectedCell(cellId);
                    setSelectedSymbol(symbol);
                    if (column?.type !== 'toggle' && column?.editable !== false) {
                        setIsCellFocused(true);
                        if (inputRef.current) {
                            inputRef.current.focus();
                        }
                    }
                }}
            >
                {column?.type === 'toggle' ? (
                    <div
                        className={`cell ${isSelected ? 'selected' : ''} toggle-cell`}
                    >
                        <button
                            className={`toggle-button ${value === 'ON' ? 'on' : 'off'}${((cellId === 'maker' && masterMaker === 'OFF') || (cellId === 'taker' && masterTaker === 'OFF')) ? ' master-disabled' : ''}`}
                            tabIndex={0}
                            onClick={((cellId === 'maker' && masterMaker === 'OFF') || (cellId === 'taker' && masterTaker === 'OFF')) ? undefined : (e) => {
                                e.stopPropagation();
                                const newValue = value === 'ON' ? 'OFF' : 'ON';
                                handleCellChange(cellId, newValue, symbol);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newValue = value === 'ON' ? 'OFF' : 'ON';
                                    handleCellChange(cellId, newValue, symbol);
                                }
                            }}
                            disabled={(cellId === 'maker' && masterMaker === 'OFF') || (cellId === 'taker' && masterTaker === 'OFF')}
                        >
                            {value}
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            ref={isSelected ? inputRef : null}
                            type="number"
                            value={value}
                            onChange={(e) => {
                                const v = e.target.value;
                                handleCellChange(cellId, v === '' ? null : v, symbol, isOverride);
                            }}
                            onKeyDown={handleKeyDown}
                            onBlur={() => setIsCellFocused(false)}
                            className={isSelected ? 'selected' : ''}
                            placeholder={isOverride ? "Override value..." : ""}
                            disabled={column?.editable === false}
                        />
                        {!isOverride && otherOverrides.length > 0 && (
                            <div className="overrides">
                                {otherOverrides.map(([id, override]) => (
                                    <div key={id} className="override">
                                        {override.value}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="spreadsheet-grid">
            <div className="grid-header">
                <h2>Trading Controller</h2>
                {renderMasterControls()}
            </div>
            <div className="grid-body">
                <div className="symbols-column">
                    <div className="header-cell"></div>
                    {symbols.map(symbol => (
                        <div 
                            key={symbol} 
                            className="symbol-cell draggable"
                            draggable
                            onDragStart={(e) => handleSymbolDragStart(e, symbol)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleSymbolDrop(e, symbol)}
                        >
                            {symbol}
                        </div>
                    ))}
                </div>
                <div className="values-grid">
                    {columns.map((col) => (
                        <div 
                            key={col.id} 
                            className="column"
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, col.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleColumnDrop(e, col.id)}
                        >
                            <div className="header-cell draggable">{col.label}</div>
                            {symbols.map(symbol => renderCell(col.id, symbol, col.id.includes('_override')))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SpreadsheetGrid; 