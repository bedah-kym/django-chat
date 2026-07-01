FROM temporalio/auto-setup:1.29.3

USER root
RUN mkdir -p /etc/temporal/config/dynamicconfig

COPY deploy/railway/temporal/development-sql.yaml /etc/temporal/config/dynamicconfig/development-sql.yaml

