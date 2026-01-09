import json
import os
import base64
from datetime import datetime

def handler(event: dict, context) -> dict:
    """Анализирует скриншот торгового графика и возвращает точный торговый сигнал"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        image_base64 = body.get('image')
        
        if not image_base64:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Image is required'}),
                'isBase64Encoded': False
            }
        
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        
        if not openai_api_key:
            return {
                'statusCode': 503,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'OPENAI_API_KEY not configured'}),
                'isBase64Encoded': False
            }
        
        import requests
        
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {openai_api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4o',
                'messages': [
                    {
                        'role': 'system',
                        'content': '''Ты эксперт по техническому анализу форекс-графиков. Проанализируй график и верни JSON:
{
  "pair": "EUR/USD",
  "type": "BUY или SELL",
  "confidence": число 65-95,
  "timeframe": "1m/5m/15m/1h/4h",
  "price": текущая цена,
  "target": целевая цена,
  "volatility": "low/medium/high",
  "reasoning": "краткое объяснение сигнала"
}

Анализируй: тренд, уровни поддержки/сопротивления, свечные паттерны, объёмы. Будь точным!'''
                    },
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'text',
                                'text': 'Проанализируй график и дай торговый сигнал на следующие 5 секунд'
                            },
                            {
                                'type': 'image_url',
                                'image_url': {
                                    'url': f'data:image/jpeg;base64,{image_base64}'
                                }
                            }
                        ]
                    }
                ],
                'max_tokens': 500,
                'temperature': 0.3
            }
        )
        
        if response.status_code != 200:
            return {
                'statusCode': response.status_code,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': f'OpenAI API error: {response.text}'}),
                'isBase64Encoded': False
            }
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # Extract JSON from markdown code blocks if present
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        analysis = json.loads(content)
        
        # Create signal object
        signal = {
            'id': str(int(datetime.now().timestamp() * 1000)),
            'pair': analysis.get('pair', 'UNKNOWN'),
            'type': analysis.get('type', 'BUY'),
            'confidence': analysis.get('confidence', 75),
            'volatility': analysis.get('volatility', 'medium'),
            'timeframe': analysis.get('timeframe', '5m'),
            'price': analysis.get('price', 0),
            'timestamp': datetime.now().strftime('%H:%M'),
            'target': analysis.get('target', 0),
            'status': 'active',
            'reasoning': analysis.get('reasoning', '')
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'signal': signal, 'analysis': analysis}),
            'isBase64Encoded': False
        }
        
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Invalid JSON: {str(e)}'}),
            'isBase64Encoded': False
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
