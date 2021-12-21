import { Box, Flex } from 'theme-ui'
import React, { useState } from 'react'
import { format } from 'd3-format'

import {
  Chart,
  Circle,
  Grid,
  Label,
  Line,
  Plot,
  TickLabels,
} from '@carbonplan/charts'
import { getShortName, useDatasetsStore } from '../../datasets'
import { useTimeStore } from '../../time'

const getArrayData = (arr) => {
  const { sum, min, max } = arr.reduce(
    (accum, el) => {
      return {
        sum: accum.sum + el,
        min: Math.min(el, accum.min),
        max: Math.max(el, accum.max),
      }
    },
    { sum: 0, min: Infinity, max: -Infinity }
  )
  return { avg: sum / arr.length, min, max }
}

// TODO: add units
export const formatValue = (value) => {
  let result
  if (value === 0) {
    result = 0
  } else if (value < 0.0001) {
    result = format('.0e')(value)
  } else if (value < 0.01) {
    result = format('.2')(value)
  } else if (value < 1) {
    result = format('.2f')(value)
  } else if (value < 10) {
    result = format('.1f')(value)
  } else if (value < 10000) {
    result = format('.0f')(value)
  } else {
    result = format('0.2s')(value)
  }

  return (
    <Box as='span' sx={{ whiteSpace: 'nowrap' }}>
      {result}
    </Box>
  )
}

const ChartWrapper = ({ data }) => {
  const [active, setActive] = useState(null)
  const datasets = useDatasetsStore((state) => state.datasets)
  const display = useTimeStore((state) => state.display)
  const dateStrings = useTimeStore((state) => state.dateStrings)
  const timeRange = useTimeStore((state) => state.range)

  // We cannot render domain before dateStrings have been loaded, so return generic loading text
  if (!dateStrings) {
    return 'Loading...'
  }

  const range = [Infinity, -Infinity]
  const lines = data
    .filter(([name, value]) => value)
    .map(([name, value]) => {
      let circle
      const lineData = Object.keys(value).map((time) => {
        const { avg, min, max } = getArrayData(value[time])
        range[0] = Math.min(range[0], min)
        range[1] = Math.max(range[1], max)

        let point = [Number(time), avg]
        if (display === point[0]) {
          circle = point
        }
        return point
      })

      return {
        key: name,
        circle,
        color: datasets[name].color,
        lineData,
      }
    })

  const loading = data.some(([name, value]) => !value)
  const activeLine = lines.find(({ key }) => key === active)

  return (
    <Box>
      <Flex sx={{ gap: 3, minHeight: '40px', mb: 4, flexWrap: 'wrap' }}>
        {!loading &&
          lines.map(({ key, circle, color }) => (
            <Box key={key} sx={{ color }}>
              <Box
                sx={{
                  fontSize: 0,
                  fontFamily: 'mono',
                  letterSpacing: 'mono',
                  textTransform: 'uppercase',
                }}
              >
                {getShortName(key)}
              </Box>
              <Box sx={{ fontSize: 3 }}>{formatValue(circle[1])}</Box>
            </Box>
          ))}
      </Flex>
      <Box sx={{ width: '100%', height: '200px', position: 'relative' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: '30%',
              left: 0,
              right: 0,
              zIndex: 1,
              width: '95px',
              mx: 'auto',
              fontFamily: 'mono',
              letterSpacing: 'mono',
              textTransform: 'uppercase',
            }}
          >
            Loading...
          </Box>
        )}
        <Chart
          x={timeRange}
          y={range}
          padding={{ left: 0, right: 0, top: 0, bottom: 50 }}
        >
          <Grid horizontal vertical />
          <TickLabels
            left
            count={4}
            format={formatValue}
            sx={{ right: 0, transform: 'translate(100%, -100%)' }}
          />
          <TickLabels
            right
            count={4}
            format={formatValue}
            sx={{
              left: 0,
              width: 'fit-content',
              transform: 'translate(-100%, -100%)',
            }}
          />
          <TickLabels
            bottom
            format={(d) =>
              dateStrings.indexToDate(Math.round(d)).toLocaleString('default', {
                month: 'numeric',
                day: 'numeric',
              })
            }
          />
          {!loading && activeLine?.circle && (
            <Label x={activeLine.circle[0]} y={activeLine.circle[1]}>
              <Box
                sx={{
                  color: activeLine.color,
                  mt: 1,
                  ml: 1,
                }}
              >
                {activeLine.key}
              </Box>
            </Label>
          )}
          <Plot>
            {!loading &&
              lines.map(({ key, circle, color, lineData }) => (
                <Box
                  as='g'
                  key={key}
                  onMouseOver={() => setActive(key)}
                  onMouseLeave={() => setActive(null)}
                >
                  <Line color={color} data={lineData} width={1.5} />
                  {circle && (
                    <Circle
                      size={[22, 18, 16]}
                      x={circle[0]}
                      y={circle[1]}
                      color={color}
                    />
                  )}
                </Box>
              ))}
          </Plot>
        </Chart>
      </Box>
    </Box>
  )
}

export default ChartWrapper
