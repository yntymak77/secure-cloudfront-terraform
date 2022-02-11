import { Unit } from 'aws-embedded-metrics'
import withTelemetry from '../tools/telemetry'

const authenticateRequest = async (token: string): Promise<boolean> => {
  // Here you can, as an example, send an HTTP Request to a
  // backend that would check the authentication token
  return Promise.resolve(token === 'MY_SECRET')
}

export const handler: AWSLambda.CloudFrontRequestHandler = async (event) => {
  return withTelemetry(async (telemetry) => {
    const request = event.Records[0].cf.request

    const token = request.headers['x-auth-token'][0].value
  
    if (token) {
      const authenticated = await authenticateRequest(token)
      if (authenticated) {
        return request
      }
    }

    telemetry.metrics.putMetric('AuthenticationFailure', 1, Unit.Count)
    telemetry.metrics.setProperty('ResponseStatus', '403')
  
    return {
      status: "403",
      headers: {
        "content-type": [
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
        "cache-control": [
          {
            key: "Cache-Control",
            value: "no-cache",
          },
        ],
      },
      bodyEncoding: "text",
      body: JSON.stringify(
        {
          error: "Unauthenticated request",
        },
        null,
        2
      ),
    }
  })
}
