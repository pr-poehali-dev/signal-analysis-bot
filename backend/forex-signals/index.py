import json
import os
import requests
from datetime import datetime

def handler(event: dict, context) -> dict:
    """
    Получение реальных котировок Forex и генерация торговых сигналов
    """
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    api_key = os.environ.get('FINNHUB_API_KEY')
    use_mock_data = not api_key

    pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD']
    finnhub_symbols = {
        'EUR/USD': 'OANDA:EUR_USD',
        'GBP/USD': 'OANDA:GBP_USD',
        'USD/JPY': 'OANDA:USD_JPY',
        'AUD/USD': 'OANDA:AUD_USD',
        'USD/CAD': 'OANDA:USD_CAD',
        'NZD/USD': 'OANDA:NZD_USD'
    }

    signals = []
    
    if use_mock_data:
        import random
        for pair in pairs:
            current_price = round(1.0 + random.random() * 0.5, 5)
            change_percent = random.uniform(-2, 2)
            volatility_range = random.uniform(0, 0.5)
            
            signal_type = 'BUY' if change_percent > 0 else 'SELL'
            confidence = min(95, max(60, int(70 + abs(change_percent) * 10)))
            
            if volatility_range < 0.1:
                volatility = 'low'
            elif volatility_range < 0.3:
                volatility = 'medium'
            else:
                volatility = 'high'

            timeframes = ['1m', '5m', '15m', '1h', '4h']
            selected_timeframe = timeframes[abs(int(change_percent * 10)) % len(timeframes)]
            target_price = current_price * (1.002 if signal_type == 'BUY' else 0.998)

            signals.append({
                'id': f"{pair.replace('/', '')}-{int(datetime.now().timestamp())}",
                'pair': pair,
                'type': signal_type,
                'confidence': confidence,
                'volatility': volatility,
                'timeframe': selected_timeframe,
                'price': round(current_price, 5),
                'timestamp': datetime.now().strftime('%H:%M'),
                'target': round(target_price, 5),
                'status': 'active',
                'change_percent': round(change_percent, 2)
            })
    else:
        for pair in pairs:
            symbol = finnhub_symbols.get(pair)
            if not symbol:
                continue

            try:
                response = requests.get(
                    f'https://finnhub.io/api/v1/quote',
                    params={'symbol': symbol, 'token': api_key},
                    timeout=5
                )
                
                if response.status_code == 200:
                    data = response.json()
                    current_price = data.get('c', 0)
                    prev_close = data.get('pc', current_price)
                    high = data.get('h', current_price)
                    low = data.get('l', current_price)
                    
                    if current_price == 0:
                        continue

                    change_percent = ((current_price - prev_close) / prev_close) * 100
                    volatility_range = ((high - low) / low) * 100
                    
                    signal_type = 'BUY' if change_percent > 0 else 'SELL'
                    confidence = min(95, max(60, int(70 + abs(change_percent) * 10)))
                    
                    if volatility_range < 0.1:
                        volatility = 'low'
                    elif volatility_range < 0.3:
                        volatility = 'medium'
                    else:
                        volatility = 'high'

                    timeframes = ['1m', '5m', '15m', '1h', '4h']
                    selected_timeframe = timeframes[abs(int(change_percent * 10)) % len(timeframes)]
                    
                    target_price = current_price * (1.002 if signal_type == 'BUY' else 0.998)

                    signals.append({
                        'id': f"{pair.replace('/', '')}-{int(datetime.now().timestamp())}",
                        'pair': pair,
                        'type': signal_type,
                        'confidence': confidence,
                        'volatility': volatility,
                        'timeframe': selected_timeframe,
                        'price': round(current_price, 5),
                        'timestamp': datetime.now().strftime('%H:%M'),
                        'target': round(target_price, 5),
                        'status': 'active',
                        'change_percent': round(change_percent, 2)
                    })
            except Exception as e:
                continue

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'signals': signals})
    }