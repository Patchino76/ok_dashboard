--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18
-- Dumped by pg_dump version 17.5

-- Started on 2025-06-24 09:26:30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 93049)
-- Name: mills; Type: SCHEMA; Schema: -; Owner: s.lyubenov
--

CREATE SCHEMA mills;


ALTER SCHEMA mills OWNER TO "s.lyubenov";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 210 (class 1259 OID 93496)
-- Name: MILL_01; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_01" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_01" OWNER TO "s.lyubenov";

--
-- TOC entry 211 (class 1259 OID 93501)
-- Name: MILL_02; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_02" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_02" OWNER TO "s.lyubenov";

--
-- TOC entry 212 (class 1259 OID 93507)
-- Name: MILL_03; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_03" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_03" OWNER TO "s.lyubenov";

--
-- TOC entry 213 (class 1259 OID 93512)
-- Name: MILL_04; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_04" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_04" OWNER TO "s.lyubenov";

--
-- TOC entry 214 (class 1259 OID 93516)
-- Name: MILL_05; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_05" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_05" OWNER TO "s.lyubenov";

--
-- TOC entry 215 (class 1259 OID 93520)
-- Name: MILL_06; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_06" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_06" OWNER TO "s.lyubenov";

--
-- TOC entry 216 (class 1259 OID 93524)
-- Name: MILL_07; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_07" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_07" OWNER TO "s.lyubenov";

--
-- TOC entry 217 (class 1259 OID 93529)
-- Name: MILL_08; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_08" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_08" OWNER TO "s.lyubenov";

--
-- TOC entry 218 (class 1259 OID 93534)
-- Name: MILL_09; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_09" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_09" OWNER TO "s.lyubenov";

--
-- TOC entry 219 (class 1259 OID 93538)
-- Name: MILL_10; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_10" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_10" OWNER TO "s.lyubenov";

--
-- TOC entry 220 (class 1259 OID 93543)
-- Name: MILL_11; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_11" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_11" OWNER TO "s.lyubenov";

--
-- TOC entry 221 (class 1259 OID 93549)
-- Name: MILL_12; Type: TABLE; Schema: mills; Owner: s.lyubenov
--

CREATE TABLE mills."MILL_12" (
    "TimeStamp" timestamp without time zone,
    "Ore" double precision,
    "WaterMill" double precision,
    "WaterZumpf" double precision,
    "Power" double precision,
    "ZumpfLevel" double precision,
    "PressureHC" double precision,
    "DensityHC" double precision,
    "PulpHC" double precision,
    "PumpRPM" double precision,
    "MotorAmp" double precision,
    "PSI80" double precision,
    "PSI200" double precision
);


ALTER TABLE mills."MILL_12" OWNER TO "s.lyubenov";

--
-- TOC entry 4152 (class 1259 OID 93499)
-- Name: ix_mills_MILL_01_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_01_TimeStamp" ON mills."MILL_01" USING btree ("TimeStamp");


--
-- TOC entry 4153 (class 1259 OID 93504)
-- Name: ix_mills_MILL_02_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_02_TimeStamp" ON mills."MILL_02" USING btree ("TimeStamp");


--
-- TOC entry 4154 (class 1259 OID 93510)
-- Name: ix_mills_MILL_03_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_03_TimeStamp" ON mills."MILL_03" USING btree ("TimeStamp");


--
-- TOC entry 4155 (class 1259 OID 93515)
-- Name: ix_mills_MILL_04_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_04_TimeStamp" ON mills."MILL_04" USING btree ("TimeStamp");


--
-- TOC entry 4156 (class 1259 OID 93519)
-- Name: ix_mills_MILL_05_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_05_TimeStamp" ON mills."MILL_05" USING btree ("TimeStamp");


--
-- TOC entry 4157 (class 1259 OID 93523)
-- Name: ix_mills_MILL_06_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_06_TimeStamp" ON mills."MILL_06" USING btree ("TimeStamp");


--
-- TOC entry 4158 (class 1259 OID 93527)
-- Name: ix_mills_MILL_07_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_07_TimeStamp" ON mills."MILL_07" USING btree ("TimeStamp");


--
-- TOC entry 4159 (class 1259 OID 93532)
-- Name: ix_mills_MILL_08_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_08_TimeStamp" ON mills."MILL_08" USING btree ("TimeStamp");


--
-- TOC entry 4160 (class 1259 OID 93537)
-- Name: ix_mills_MILL_09_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_09_TimeStamp" ON mills."MILL_09" USING btree ("TimeStamp");


--
-- TOC entry 4161 (class 1259 OID 93541)
-- Name: ix_mills_MILL_10_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_10_TimeStamp" ON mills."MILL_10" USING btree ("TimeStamp");


--
-- TOC entry 4162 (class 1259 OID 93546)
-- Name: ix_mills_MILL_11_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_11_TimeStamp" ON mills."MILL_11" USING btree ("TimeStamp");


--
-- TOC entry 4163 (class 1259 OID 93552)
-- Name: ix_mills_MILL_12_TimeStamp; Type: INDEX; Schema: mills; Owner: s.lyubenov
--

CREATE INDEX "ix_mills_MILL_12_TimeStamp" ON mills."MILL_12" USING btree ("TimeStamp");


-- Completed on 2025-06-24 09:26:30

--
-- PostgreSQL database dump complete
--

