# Backr Canton Dockerfile
# Based on Canton Open Source 2.9.x

FROM digitalasset/canton-open-source:2.9.0

# Set working directory
WORKDIR /canton

# Copy configuration
COPY canton.conf /canton/canton.conf
COPY bootstrap.canton /canton/bootstrap.canton

# Create directories
RUN mkdir -p /canton/dars /canton/data

# Copy DAR files
COPY dars/*.dar /canton/dars/

# Expose ports
# 5011 - Ledger API (gRPC)
# 5012 - Admin API (gRPC)
# 5008 - Sequencer Public API
# 5009 - Sequencer Admin API
# 5007 - Mediator Admin API
EXPOSE 5011 5012 5008 5009 5007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD grpc_health_probe -addr=localhost:5011 || exit 1

# Run Canton daemon with configuration
ENTRYPOINT ["bin/canton"]
CMD ["daemon", "--config", "/canton/canton.conf", "--bootstrap", "/canton/bootstrap.canton"]
