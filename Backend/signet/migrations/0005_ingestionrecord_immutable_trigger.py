from django.db import migrations


def repair_ingestion_record_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        CREATE OR REPLACE FUNCTION block_ingestion_record_update()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'IngestionRecord is immutable and cannot be updated. id=%', OLD.id;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS ingestion_record_immutable_trigger ON signet_ingestionrecord;
        CREATE TRIGGER ingestion_record_immutable_trigger
        BEFORE UPDATE ON signet_ingestionrecord
        FOR EACH ROW EXECUTE FUNCTION block_ingestion_record_update();
    """)


def drop_ingestion_record_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        DROP TRIGGER IF EXISTS ingestion_record_immutable_trigger ON signet_ingestionrecord;
        DROP FUNCTION IF EXISTS block_ingestion_record_update();
    """)


class Migration(migrations.Migration):
    """Forward-only repair: migration 0002's RunSQL that creates the
    IngestionRecord immutability trigger never executed against existing
    databases (0002 was recorded as applied before the SQL was added to it).
    Recreate the trigger idempotently here so it exists everywhere.
    """

    dependencies = [
        ('signet', '0004_postclassification_signet_review'),
    ]

    operations = [
        migrations.RunPython(repair_ingestion_record_trigger, drop_ingestion_record_trigger),
    ]
