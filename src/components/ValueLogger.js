import React, { useState, useEffect } from 'react';
import './ValueLogger.css';

const ValueLogger = () => {
    const [logs, setLogs] = useState([]);
    const [selectedSymbol, setSelectedSymbol] = useState('all');
    const [selectedField, setSelectedField] = useState('all');
    const [showOverrides, setShowOverrides] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await fetch('http://localhost:8000/logs');
                if (!response.ok) {
                    throw new Error('Logging service not available');
                }
                const data = await response.json();
                setLogs(data.logs || []);
                setError(null);
            } catch (error) {
                console.error('Error fetching logs:', error);
                setError('Logging service not available');
                setLogs([]);
            }
        };

        // Fetch logs immediately and then every second
        fetchLogs();
        const interval = setInterval(fetchLogs, 1000);

        return () => clearInterval(interval);
    }, []);

    // Get unique symbols and fields from logs
    const symbols = ['all', ...new Set(logs.map(log => log.symbol))];
    const fields = ['all', ...new Set(logs.map(log => log.field))];

    // Filter logs based on selection
    const filteredLogs = logs.filter(log => {
        const symbolMatch = selectedSymbol === 'all' || log.symbol === selectedSymbol;
        const fieldMatch = selectedField === 'all' || log.field === selectedField;
        const overrideMatch = showOverrides || log.is_override === 'False';
        return symbolMatch && fieldMatch && overrideMatch;
    });

    // Group logs by timestamp for better visualization
    const groupedLogs = filteredLogs.reduce((acc, log) => {
        const timestamp = log.timestamp;
        if (!acc[timestamp]) {
            acc[timestamp] = [];
        }
        acc[timestamp].push(log);
        return acc;
    }, {});

    return (
        <div className="value-logger">
            <div className="logger-controls">
                <select 
                    value={selectedSymbol} 
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                >
                    {symbols.map(symbol => (
                        <option key={symbol} value={symbol}>
                            {symbol === 'all' ? 'All Symbols' : symbol}
                        </option>
                    ))}
                </select>

                <select 
                    value={selectedField} 
                    onChange={(e) => setSelectedField(e.target.value)}
                >
                    {fields.map(field => (
                        <option key={field} value={field}>
                            {field === 'all' ? 'All Fields' : field}
                        </option>
                    ))}
                </select>

                <label>
                    <input
                        type="checkbox"
                        checked={showOverrides}
                        onChange={(e) => setShowOverrides(e.target.checked)}
                    />
                    Show Overrides
                </label>
            </div>

            <div className="logs-container">
                {error ? (
                    <div className="error-message">
                        {error}
                    </div>
                ) : Object.entries(groupedLogs).length === 0 ? (
                    <div className="no-logs-message">
                        No logs available
                    </div>
                ) : (
                    Object.entries(groupedLogs).map(([timestamp, logs]) => (
                        <div key={timestamp} className="log-group">
                            <div className="timestamp">
                                {new Date(timestamp).toLocaleTimeString()}
                            </div>
                            <div className="log-entries">
                                {logs.map((log, index) => (
                                    <div 
                                        key={`${timestamp}-${index}`} 
                                        className={`log-entry ${log.is_override === 'True' ? 'override' : ''}`}
                                    >
                                        <span className="symbol">{log.symbol}</span>
                                        <span className="field">{log.field}</span>
                                        <span className="value">{log.value}</span>
                                        {log.is_override === 'True' && (
                                            <span className="user-id">by {log.user_id}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ValueLogger; 